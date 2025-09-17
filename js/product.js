import { supabase } from '/js/supabaseClient.js';



(function () {
    const YEAR = document.getElementById('year');
    if (YEAR) YEAR.textContent = new Date().getFullYear();

    const qs = s => document.querySelector(s);
    const idParam = (new URLSearchParams(location.search).get('id') || '').trim().toLowerCase();

    const mainImg = qs('#prodMainImg');
    const thumbs = qs('#prodThumbs');
    const titleEl = qs('#prodTitle');
    const priceEl = qs('#prodPrice');
    const metaEl = qs('#prodMeta');
    const tagsEl = qs('#prodTags');
    const qtyIn = qs('#qtyInput');
    const minus = qs('#qtyMinus');
    const plus = qs('#qtyPlus');
    const addBtn = qs('#addToCart');
    const wspBtn = qs('#buyWhats');
    const crumbs = qs('#crumbs');

    let PRODUCT = null;

    init().catch(e => { console.error(e); render404(); });

    async function init() {
        if (!idParam) { render404(); return; }

        // 1) intenta por id exacto (products.id)
        let p = await loadById(idParam);

        // 2) si no existe, intenta por slug brand-name
        let catalog = [];
        if (!p) {
            catalog = await loadAllMinimal();                 // cache del catálogo (campos mínimos)
            window.PRODUCTS = catalog;                        // útil para carrito/relacionados
            p = catalog.find(x => slug(`${x.brand}-${x.name}`) === idParam);
        } else {
            // si encontraste por id, igual carga catálogo mínimo para “Relacionados”
            catalog = await loadAllMinimal();
            window.PRODUCTS = catalog;
        }

        if (!p) { render404(idParam, catalog); return; }

        PRODUCT = p;
        renderProduct(PRODUCT);
        renderRelated(catalog, PRODUCT);
        wire();
        if (typeof injectProductLD === 'function') injectProductLD(PRODUCT);
    }

    // --- helpers de carga en Supabase ---
    async function loadById(id) {
        const { data, error } = await supabase
            .from('products')
            .select('id,brand,name,gender,size,price,list_price,tags,image,images')
            .eq('id', id).maybeSingle();
        if (error) console.warn(error);
        return data ? ({ ...data, listPrice: data.list_price }) : null;
    }

    async function loadAllMinimal() {
        const { data, error } = await supabase
            .from('products')
            .select('id,brand,name,gender,size,price,list_price,tags,image,images')
            .order('brand', { ascending: true })
            .limit(2000);
        if (error) { console.error(error); return []; }
        return (data || []).map(p => ({ ...p, listPrice: p.list_price }));
    }


    function renderProduct(p) {
        // Título
        titleEl.textContent = `${p.brand} ${p.name}`;

        // Imagen principal
        mainImg.src = p.image;
        mainImg.alt = `${p.brand} ${p.name}`;
        mainImg.onerror = () => mainImg.src = '/assets/placeholder.webp';
        // Activa zoom sobre el contenedor .prod-main
        const zoomBox = document.querySelector('.prod-main');
        setupZoom(mainImg, zoomBox, 2.5); // 2.5 = nivel de zoom (ajústalo a tu gusto)


        // Thumbs (usa p.images[] si existe; si no, intenta variantes -1,-2…)
        const images = Array.isArray(p.images) && p.images.length ? p.images : guessImages(p);
        thumbs.innerHTML = images.map((src, i) => `
      <button class="${i === 0 ? 'active' : ''}" data-src="${src}">
        <img src="${src}" alt="${p.name} vista ${i + 1}" onerror="this.parentElement.style.display='none'">
      </button>
    `).join('');

        // Precio
        const now = money(p.price);
        const list = p.listPrice && p.price < p.listPrice ? money(p.listPrice) : null;
        priceEl.innerHTML = `<span class="now">${now}</span>${list ? ` <del class="list">${list}</del>` : ''}`;

        // Meta
        metaEl.textContent = `${p.size || '100ml'} · ${p.gender || ''}`;

        // Tags
        const tags = (p.tags || []);
        tagsEl.innerHTML = tags.map(t => `<a class="chip" href="category.html?tags=${encodeURIComponent(t)}">${t}</a>`).join('');

        // Migas
        crumbs.innerHTML = `<a href="/">Inicio</a> / <a href="category.html">Catálogo</a> / <span>${p.brand} · ${p.name}</span>`;
    }

    function wire() {
        // thumbs
        thumbs.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-src]');
            if (!btn) return;
            mainImg.src = btn.getAttribute('data-src');
            thumbs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });

        // qty
        minus.addEventListener('click', () => qtyIn.value = Math.max(1, (+qtyIn.value || 1) - 1));
        plus.addEventListener('click', () => qtyIn.value = (+qtyIn.value || 1) + 1);

        // add to cart
        addBtn.addEventListener('click', () => {
            const q = Math.max(1, parseInt(qtyIn.value, 10) || 1);
            window.Cart?.add(PRODUCT.id, q);
            document.getElementById('cartDrawer')?.classList.add('open');
        });

        // comprar por WhatsApp
        wspBtn.addEventListener('click', () => {
            const q = Math.max(1, parseInt(qtyIn.value, 10) || 1);
            const text = encodeURIComponent(
                `Hola, quiero *${PRODUCT.brand} - ${PRODUCT.name}* (${PRODUCT.size || '100ml'}) x${q}.\nPrecio: ${money(PRODUCT.price)}`
            );
            window.open(`https://wa.me/573000000000?text=${text}`, '_blank');
        });

        // menú móvil
        document.querySelector('.nav-toggle')?.addEventListener('click', () => {
            const nav = document.querySelector('.nav');
            nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
        });
    }

    function renderRelated(all, p) {
        // por marca o por tags
        const pool = all.filter(x => x.id !== p.id && (x.brand === p.brand || shareTag(x, p)));
        if (!pool.length) return;

        const list = pool.slice(0, 12);
        const track = document.getElementById('relatedTrack');
        document.getElementById('relatedBlock').hidden = false;

        track.innerHTML = list.map(x => `
      <article class="card">
        <a class="card-link" href="product.html?id=${x.id}">
          <div class="card__img">
            <img src="${x.image}" alt="${x.brand} ${x.name}" loading="lazy"
                 onerror="this.onerror=null;this.src='/assets/placeholder.webp'">
          </div>
          <div class="card__body">
            <div class="card__title">${x.brand} · ${x.name}</div>
            <div class="card__meta"><span class="muted">${x.size || '100ml'} · ${x.gender || ''}</span></div>
          </div>
        </a>
        <div class="card__body">
          <div class="price-row"><span class="price">${money(x.price)}</span></div>
          <div class="card__actions"><button class="btn" data-cart="${x.id}">Añadir al carrito</button></div>
        </div>
      </article>
    `).join('');

        track.querySelectorAll('[data-cart]').forEach(btn => {
            btn.addEventListener('click', () => {
                const pid = btn.getAttribute('data-cart');
                window.Cart?.add(pid, 1);
            });
        });
    }

    function shareTag(a, b) {
        const A = new Set((a.tags || []).map(s => s.toLowerCase()));
        return (b.tags || []).some(t => A.has(String(t).toLowerCase()));
    }

    function guessImages(p) {
        try {
            const base = p.image.replace(/\.(jpg|jpeg|png|webp)$/i, '');
            const ext = (p.image.match(/\.(jpg|jpeg|png|webp)$/i) || ['.jpg'])[0];
            return [p.image, `${base}-1${ext}`, `${base}-2${ext}`, `${base}-3${ext}`];
        } catch { return [p.image]; }
    }

    function money(n) {
        return (n ?? 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    }

    // helpers slug
    function slug(text) {
        return stripAccents(String(text))
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    function stripAccents(s) {
        return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    /* ====== Zoom: efecto lupa sobre .prod-main ====== */
    function setupZoom(mainImgEl, zoomBoxEl, zoomLevel = 2.2) {
        if (!mainImgEl || !zoomBoxEl) return;

        // Asegura clase para el CSS
        mainImgEl.classList.add('zoom-target');

        const getHiRes = () => mainImgEl.dataset.zoom || mainImgEl.src; // si tienes una imagen más grande, usa data-zoom

        function enter() {
            zoomBoxEl.classList.add('zoom-active');
            zoomBoxEl.style.backgroundImage = `url("${getHiRes()}")`;
            zoomBoxEl.style.backgroundSize = `${zoomLevel * 100}%`;
        }
        function move(e) {
            const rect = zoomBoxEl.getBoundingClientRect();
            const cx = (e.clientX ?? (e.touches && e.touches[0].clientX)) - rect.left;
            const cy = (e.clientY ?? (e.touches && e.touches[0].clientY)) - rect.top;
            const x = Math.max(0, Math.min(1, cx / rect.width)) * 100;
            const y = Math.max(0, Math.min(1, cy / rect.height)) * 100;
            zoomBoxEl.style.backgroundPosition = `${x}% ${y}%`;
        }
        function leave() {
            zoomBoxEl.classList.remove('zoom-active');
            zoomBoxEl.style.backgroundImage = '';
            zoomBoxEl.style.backgroundSize = '';
            zoomBoxEl.style.backgroundPosition = '';
        }

        // Desktop
        zoomBoxEl.addEventListener('mouseenter', enter);
        zoomBoxEl.addEventListener('mousemove', move);
        zoomBoxEl.addEventListener('mouseleave', leave);

        // Touch (tap para activar / tap fuera para salir)
        zoomBoxEl.addEventListener('touchstart', (e) => { enter(); move(e); }, { passive: true });
        zoomBoxEl.addEventListener('touchmove', move, { passive: true });
        zoomBoxEl.addEventListener('touchend', leave);
    }

})();
