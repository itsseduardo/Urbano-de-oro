import { supabase } from '/js/supabaseClient.js';

/* ===== Helper vista grid/list (opcional) ===== */
function setupViewToggle({ grid, initial = 'grid' }) {
  const container = document.getElementById('viewToggle');
  if (!container || !grid) return () => {};
  const btns = [...container.querySelectorAll('[data-view]')];
  const url  = new URL(location.href);
  const q    = url.searchParams;
  let view = q.get('view') || initial;

  const apply = (v) => {
    view = v;
    grid.classList.toggle('is-list', v === 'list');
    btns.forEach(b => {
      const on = b.dataset.view === v;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on);
    });
    if (q.get('view') !== v) {
      q.set('view', v);
      history.replaceState({}, '', `${url.pathname}?${q}`);
    }
  };

  btns.forEach(b => b.addEventListener('click', () => apply(b.dataset.view)));
  apply(view);
  return apply;
}

const GRID = document.getElementById('offerGrid');
const EMPTY = document.getElementById('noOffers');

init();

async function init(){
  const { data, error } = await supabase
    .from('products')
    .select('id,brand,name,image,tags,price,list_price,offer_ends_at,created_at')
    .not('list_price','is', null)
    .order('created_at', { ascending:false })
    .limit(500);

  if (error) { console.error(error); GRID.innerHTML=''; EMPTY.hidden=false; return; }

  const now = Date.now();
  let items = (data||[])
    .map(p => ({ ...p, listPrice: p.list_price }))
    .filter(p => (p.listPrice ?? 0) > 0 && p.price < p.listPrice)
    .filter(p => !p.offer_ends_at || new Date(p.offer_ends_at).getTime() > now);

  items.sort((a,b) => disc(b)-disc(a));

  render(items);
  EMPTY.hidden = items.length > 0;
  bindCart();
  startCountdowns();

  // toggle (si existe el bloque en el HTML)
  setupViewToggle({ grid: GRID });
}

function money(n){ return (n??0).toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}); }
const disc = p => Math.round( (1 - (p.price/(p.listPrice||p.price))) * 100 );

function render(items){
  GRID.innerHTML = items.map(p => `
    <article class="card offer-card">
      <a class="card-link" href="/product.html?id=${p.id}" aria-label="${p.brand} ${p.name}">
        <div class="card__img">
          ${p.listPrice ? `<span class="badge badge--discount">-${disc(p)}%</span>` : ``}
          ${p.offer_ends_at ? `
            <div class="timer-strip" data-deadline="${p.offer_ends_at}">
              LA OFERTA FINALIZA EN: <b class="dd">--</b> DÍAS, <b class="hh">--</b>:<b class="mm">--</b>:<b class="ss">--</b>
            </div>` : ``}
          <img src="${p.image || '/assets/placeholder.webp'}" alt="${p.brand} ${p.name}" loading="lazy"
               onerror="this.onerror=null;this.src='/assets/placeholder.webp'">
        </div>
      </a>

      <div class="card__body">
        <div class="card__meta">
          <span class="muted">${(p.tags||[]).join(', ') || '&nbsp;'}</span>
        </div>
        <div class="card__title">${p.brand} · ${p.name}</div>
        <div class="price-row">
          <span class="price">${money(p.price)}</span>
          ${p.listPrice ? `<span class="list">${money(p.listPrice)}</span>` : ``}
        </div>
        <div class="card__actions">
          <button class="btn btn--primary" data-cart="${p.id}">Añadir al carrito</button>
        </div>
      </div>
    </article>
  `).join('');
}

function bindCart(){
  GRID.querySelectorAll('[data-cart]').forEach(btn => {
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-cart');
      window.Cart?.add(id, 1);
    });
  });
}

/* ======== Countdown ======== */
function startCountdowns(){
  const strips = [...document.querySelectorAll('.timer-strip[data-deadline]')];
  if (!strips.length) return;

  function tick(){
    const now = Date.now();
    strips.forEach(el=>{
      const t = new Date(el.dataset.deadline).getTime() - now;
      if (isNaN(t)) { el.remove(); return; }
      if (t <= 0) { el.textContent = 'OFERTA FINALIZADA'; return; }
      const d = Math.floor(t/86400000);
      const h = Math.floor((t%86400000)/3600000);
      const m = Math.floor((t%3600000)/60000);
      const s = Math.floor((t%60000)/1000);
      el.querySelector('.dd').textContent = String(d);
      el.querySelector('.hh').textContent = String(h).padStart(2,'0');
      el.querySelector('.mm').textContent = String(m).padStart(2,'0');
      el.querySelector('.ss').textContent = String(s).padStart(2,'0');
    });
  }
  tick();
  setInterval(tick, 1000);
}
