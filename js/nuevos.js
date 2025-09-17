import { supabase } from '/js/supabaseClient.js';

/* ===== Helper vista grid/list (reutilizable) ===== */
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

const qs = s => document.querySelector(s);
const GRID = qs('#catGrid'), EMPTY = qs('#emptyCat');
const RESULTS = qs('#resultsInfo'), PAGEINFO = qs('#pageInfo');
const PERSEL = qs('#perSelect'), SORTSEL = qs('#sortSelect');
const PREV = qs('#prevPage'), NEXT = qs('#nextPage');
const CAT_TITLE = qs('#catTitle'), CRUMB = qs('#crumbCat');
const FACET = qs('#facetList');

let RAW = [], ITEMS = [], VIEW = 'grid', PER = 30, PAGE = 1, SORT = 'default', SELECTED = new Set();
const params = new URLSearchParams(location.search);
const DAYS = Number(params.get('days') || 60);

init();

async function init(){
  parseURL();
  CAT_TITLE.textContent = 'Nuevos lanzamientos';
  CRUMB.textContent = 'Nuevos';

  RAW = await loadNew();
  buildFacets(RAW);
  apply(true);
  bind();

  setupViewToggle({ grid: GRID, initial: VIEW });
}

/* ====== DATA ====== */
async function loadNew(){
  const since = new Date(Date.now() - DAYS*86400000).toISOString();

  const q1 = supabase.from('products')
    .select('id,brand,name,gender,size,price,list_price,tags,image,created_at')
    .gte('created_at', since);

  const q2 = supabase.from('products')
    .select('id,brand,name,gender,size,price,list_price,tags,image,created_at')
    .contains('tags', ['nuevo']);

  const [r1, r2] = await Promise.all([q1, q2]);
  if (r1.error) console.error(r1.error);
  if (r2.error) console.error(r2.error);

  const map = new Map();
  [...(r1.data||[]), ...(r2.data||[])].forEach(p => {
    const x = { ...p, listPrice: p.list_price };
    map.set(x.id, x);
  });
  return [...map.values()];
}

/* ====== FACETS (tags) ====== */
function buildFacets(arr){
  const set = new Set();
  arr.forEach(p => (p.tags||[]).forEach(t => set.add(String(t).toLowerCase())));
  FACET.innerHTML = [...set].sort((a,b)=>a.localeCompare(b,'es'))
   .map(tag=>{
     const id = `tag-${tag.replace(/\s+/g,'-')}`;
     return `<label class="facet-item">
       <input id="${id}" type="checkbox" value="${tag}">
       <span>${tag.charAt(0).toUpperCase()+tag.slice(1)}</span>
     </label>`;
   }).join('');

  FACET.querySelectorAll('input').forEach(cb=>{
    cb.checked = SELECTED.has(cb.value);
    cb.addEventListener('change', ()=>{
      cb.checked ? SELECTED.add(cb.value) : SELECTED.delete(cb.value);
      PAGE = 1; apply(true);
    });
  });
}

/* ====== APLICAR ====== */
function apply(push){
  ITEMS = RAW.filter(p => {
    if (!SELECTED.size) return true;
    const tags = (p.tags||[]).map(s => String(s).toLowerCase());
    return [...SELECTED].some(t => tags.includes(t));
  });

  ITEMS.sort(sorter(SORT));

  const total = ITEMS.length, pages = Math.max(1, Math.ceil(total / PER));
  PAGE = Math.min(Math.max(1, PAGE), pages);
  const slice = ITEMS.slice((PAGE-1)*PER, (PAGE-1)*PER + PER);

  render(slice);
  EMPTY.hidden = slice.length > 0;
  RESULTS.textContent = `${total} resultado${total!==1?'s':''}`;
  PAGEINFO.textContent = `Página ${PAGE} de ${pages}`;
  PREV.disabled = PAGE <= 1; NEXT.disabled = PAGE >= pages;

  const curView = new URLSearchParams(location.search).get('view') || 'grid';
  GRID.classList.toggle('is-list', curView === 'list');

  if (push){
    const q = new URLSearchParams();
    if (curView !== 'grid') q.set('view', curView);
    if (PER !== 30)     q.set('per', String(PER));
    if (PAGE !== 1)     q.set('page', String(PAGE));
    if (SORT !== 'default') q.set('sort', SORT);
    if (SELECTED.size)  q.set('tags', [...SELECTED].join(','));
    if (DAYS !== 60)    q.set('days', String(DAYS));
    history.pushState({}, '', `${location.pathname}?${q.toString()}`);
  }
}

function sorter(k){
  const num = x => Number(x||0);
  switch(k){
    case 'dateDesc':  return (a,b)=> new Date(b.created_at) - new Date(a.created_at);
    case 'priceAsc':  return (a,b)=> num(a.price) - num(b.price);
    case 'priceDesc': return (a,b)=> num(b.price) - num(a.price);
    case 'nameAsc':   return (a,b)=> a.name.localeCompare(b.name,'es');
    case 'nameDesc':  return (a,b)=> b.name.localeCompare(a.name,'es');
    default:          return ()=>0;
  }
}

/* ====== RENDER ====== */
function money(n){ return (n??0).toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}); }

function render(items){
  GRID.innerHTML = items.map(p => `
    <article class="card">
      <a class="card-link" href="product.html?id=${p.id}" aria-label="${p.brand} ${p.name}">
        <div class="card__img">
          <img src="${p.image || '/assets/placeholder.webp'}" alt="${p.brand} ${p.name}" loading="lazy"
               onerror="this.onerror=null;this.src='/assets/placeholder.webp'">
        </div>
      </a>
      <div class="card__body">
        <div class="card__tags">${(p.tags||[]).join(', ')}</div>
        <div class="card__title">${p.brand} · ${p.name}</div>
        <div class="card__meta"><span class="muted">${p.size||'100ml'} · ${p.gender||''}</span></div>
        <div class="price-row">
          <span class="price">${money(p.price)}</span>
          ${p.listPrice ? `<span class="list">${money(p.listPrice)}</span>` : ``}
        </div>
        <div class="card__actions">
          <button class="btn btn--primary" data-cart="${p.id}">Añadir al carrito</button>
          <a class="btn icon-only" href="product.html?id=${p.id}" aria-label="Ver ficha">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <path d="M15 3h6v6"/>
              <path d="M10 14L21 3"/>
            </svg>
          </a>
        </div>
      </div>
    </article>
  `).join('');

  GRID.querySelectorAll('[data-cart]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-cart');
      window.Cart?.add(id, 1);
    });
  });
}

/* ====== BIND UI ====== */
function bind(){
  PERSEL.addEventListener('change', ()=>{ PER = parseInt(PERSEL.value,10); PAGE=1; apply(true); });
  SORTSEL.addEventListener('change', ()=>{ SORT = SORTSEL.value; PAGE=1; apply(true); });

  PREV.addEventListener('click', ()=>{ PAGE = Math.max(1, PAGE-1); apply(true); });
  NEXT.addEventListener('click', ()=>{ PAGE = PAGE+1; apply(true); });

  window.addEventListener('popstate', ()=>{ parseURL(); apply(false); });
}

function parseURL(){
  const p = new URLSearchParams(location.search);
  VIEW = p.get('view') || 'grid';
  PER  = parseInt(p.get('per')  || '30', 10);
  PAGE = parseInt(p.get('page') || '1',  10);
  SORT = p.get('sort') || 'default';
  SELECTED = new Set( (p.get('tags')||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean) );

  PERSEL.value = String(PER);
  SORTSEL.value = SORT;
}
