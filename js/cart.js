/* cart.js — carrito simple con localStorage y checkout por WhatsApp */
(() => {
  const KEY = 'cart_v1';
  const COP = n => (n ?? 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  // Estado
  let cart = load();

  // DOM
  const elOpen = document.getElementById('cartOpen');
  const elCount = document.getElementById('cartCount');
  const drawer = document.getElementById('cartDrawer');
  const panel = drawer?.querySelector('.cart-panel');
  const elClose = document.getElementById('cartClose');
  const elBack = document.getElementById('cartBackdrop');
  const list = document.getElementById('cartItems');
  const sub = document.getElementById('cartSubtotal');
  const btnClr = document.getElementById('cartClear');
  const btnWsp = document.getElementById('cartWhats');

  // API pública simple
  window.Cart = {
    add: (id, qty = 1) => { add(id, qty); },
    remove: (id) => { cart = cart.filter(it => it.id !== id); save(); render(); },
    qty: (id, q) => { const it = cart.find(x => x.id === id); if (it) { it.qty = Math.max(1, q); save(); render(); } },
    clear: () => { cart = []; save(); render(); },
    items: () => [...cart]
  };

  // Hook global "Añadir al carrito"
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cart]');
    if (!btn) return;
    e.preventDefault();
    const id = btn.getAttribute('data-cart');
    add(id, 1);
  });

  // Abrir / Cerrar
  elOpen?.addEventListener('click', (e) => { e.preventDefault(); open(); });
  elClose?.addEventListener('click', close);
  elBack?.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  // Acciones footer
  btnClr?.addEventListener('click', () => { Cart.clear(); });
  btnWsp?.addEventListener('click', () => { goWhatsApp(); });

  // Inicial
  render();

  /* ---------- Funciones ---------- */
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(cart)); }

  function add(id, qty) {
    if (!id) return;
    const it = cart.find(x => x.id === id);
    if (it) it.qty += qty;
    else cart.push({ id, qty });
    save(); bump(); render();
  }

  function bump() { // animación rápida del contador
    if (!elCount) return;
    elCount.classList.add('pulse');
    setTimeout(() => elCount.classList.remove('pulse'), 300);
  }

  function open() { drawer?.classList.add('open'); panel?.focus(); }
  function close() { drawer?.classList.remove('open'); }

  async function getProducts() {
    // 1) Si la página ya cargó catálogo, úsalo
    if (Array.isArray(window.PRODUCTS) && window.PRODUCTS.length) return window.PRODUCTS;

    // 2) Consulta a Supabase solo los ids que están en el carrito
    try {
      const ids = [...new Set(cart.map(x => x.id))];
      if (ids.length) {
        const { supabase } = await import('/js/supabaseClient.js');
        const { data, error } = await supabase
          .from('products')
          .select('id,brand,name,gender,size,price,list_price,image')
          .in('id', ids);
        if (error) throw error;
        return (data || []).map(p => ({ ...p, listPrice: p.list_price }));
      }
    } catch (e) {
      console.warn('Fallback a JSON, Supabase no disponible en cart:', e);
    }

    // 3) Compatibilidad: si aún tienes el JSON local
    try { return await (await fetch('/data/products.json')).json(); } catch { return []; }
  }


  async function render() {
    // icono
    const count = cart.reduce((a, b) => a + b.qty, 0);
    if (elCount) elCount.textContent = count;

    // listado
    if (!list) return;
    const products = await getProducts();
    const lookup = Object.fromEntries(products.map(p => [p.id, p]));

    let html = '';
    let subtotal = 0;

    for (const it of cart) {
      const p = lookup[it.id];
      if (!p) continue;
      const line = (p.price || 0) * it.qty;
      subtotal += line;
      html += `
        <div class="cart-item">
          <div class="cart-thumb"><img src="${p.image}" alt="${p.brand} ${p.name}"></div>
          <div class="cart-meta">
            <div class="title">${p.brand} · ${p.name}</div>
            <div class="muted">${p.size || '100ml'} · ${p.gender || ''}</div>
            <div class="muted">${COP(p.price)} c/u</div>
          </div>
          <div class="cart-qty">
            <button class="qty-btn" data-qtyminus="${p.id}">−</button>
            <span>${it.qty}</span>
            <button class="qty-btn" data-qtyplus="${p.id}">+</button>
          </div>
          <div style="min-width:90px; text-align:right">
            <div><strong>${COP(line)}</strong></div>
            <button class="icon-btn" data-remove="${p.id}" title="Quitar">🗑️</button>
          </div>
        </div>
      `;
    }

    list.innerHTML = html || `<div class="empty">Tu carrito está vacío.</div>`;
    if (sub) sub.textContent = COP(subtotal);

    // bind controles línea
    list.querySelectorAll('[data-qtyminus]').forEach(b => b.addEventListener('click', () => {
      const id = b.getAttribute('data-qtyminus'); const it = cart.find(x => x.id === id); if (it) { it.qty = Math.max(1, it.qty - 1); save(); render(); }
    }));
    list.querySelectorAll('[data-qtyplus]').forEach(b => b.addEventListener('click', () => {
      const id = b.getAttribute('data-qtyplus'); const it = cart.find(x => x.id === id); if (it) { it.qty = it.qty + 1; save(); render(); }
    }));
    list.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
      const id = b.getAttribute('data-remove'); cart = cart.filter(x => x.id !== id); save(); render();
    }));
  }

  async function goWhatsApp() {
    const products = await getProducts();
    const lookup = Object.fromEntries(products.map(p => [p.id, p]));
    if (!cart.length) { open(); return; }
    let txt = `Hola, quiero hacer este pedido:%0A%0A`;
    let total = 0;
    cart.forEach(it => {
      const p = lookup[it.id]; if (!p) return;
      const line = (p.price || 0) * it.qty; total += line;
      txt += `• ${p.brand} - ${p.name} (${p.size || '100ml'}) x${it.qty} — ${COP(line)}%0A`;
    });
    txt += `%0ATotal: ${COP(total)}%0AForma de pago: ___%0AEnvío a: ___`;
    window.open(`https://wa.me/573116997253?text=${txt}`, '_blank');
  }
})();
