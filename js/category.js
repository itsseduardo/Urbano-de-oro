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

/* ========== CATÁLOGO ========== */
const YEAR = document.getElementById('year');
if (YEAR) YEAR.textContent = new Date().getFullYear();

const qs = s => document.querySelector(s);
const GRID = qs('#catGrid');
const EMPTY = qs('#emptyCat');
const RESULTS = qs('#resultsInfo');
const PERSEL = qs('#perSelect');
const SORTSEL = qs('#sortSelect');
const PAGER = qs('#PAGER');
const CAT_TITLE = qs('#catTitle');
const CRUMB = qs('#crumbCat');

/* si aún existen, los ocultamos (usaremos paginación numerada) */
qs('#prevPage')?.closest('.cat-pagination')?.setAttribute('hidden','');

/* Estado */
let PRODUCTS = [];
let VIEW = 'grid', PER = 30, PAGE = 1, SORT = 'default', CATEGORY = 'all', TAG = '';

/* Familias */
const FAMILIES = [
  'Amaderado','Ámbar','Aromático','Atalcado','Avainillado','Cálido Especiado',
  'Cítricos','Coco','Cuero','Dulces','Florales','Frutales','Gourmand','Herbal','Marino','Oriental','Verde'
];

/* helpers */
const slug  = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const money = n => (n??0).toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0});
const hasTag= (p,t)=> (p.tags||[]).map(x=>slug(x)).includes(slug(t));

init();

async function init(){
  parseURL();
  await loadCatalog();
  renderFacets();
  apply(true);
  bind();
  setupViewToggle({ grid: GRID, initial: VIEW });
}

/* CARGA SUPABASE */
async function loadCatalog(){
  try{
    const { data, error } = await supabase
      .from('products')
      .select('id,brand,name,gender,size,price,list_price,tags,image,created_at') // ← sin "images"
      .order('brand', { ascending:true })
      .limit(2000);
    if (error) throw error;
    PRODUCTS = (data||[]).map(p => ({ ...p, listPrice: p.list_price ?? null }));
  }catch(e){
    console.error('Error cargando catálogo:', e);
    PRODUCTS = [];
  }
}

function parseURL(){
  const p = new URLSearchParams(location.search);
  CATEGORY = (p.get('cat') || 'all').toLowerCase();
  VIEW     = p.get('view') || 'grid';
  PER      = parseInt(p.get('per') || '30',10) || 30;
  PAGE     = parseInt(p.get('page')|| '1',10) || 1;
  SORT     = p.get('sort') || 'default';
  TAG      = (p.get('tags')||'').toLowerCase();

  const pretty = { hombre:'Caballero', mujer:'Dama', unisex:'Unisex', nicho:'Nicho', all:'Catálogo' };
  CAT_TITLE && (CAT_TITLE.textContent = pretty[CATEGORY] || 'Catálogo');
  CRUMB && (CRUMB.textContent = CAT_TITLE?.textContent || 'Catálogo');
  PERSEL && (PERSEL.value = String(PER));
  SORTSEL && (SORTSEL.value = SORT);
}

function renderFacets(){
  const box = qs('#facetList'); if (!box) return;
  const preserve = (updates={})=>{
    const p = new URLSearchParams(location.search);
    p.set('page','1');
    Object.entries(updates).forEach(([k,v])=>{
      if (v===null || v==='') p.delete(k); else p.set(k,v);
    });
    return `?${p.toString()}`;
  };
  const list = [
    `<li class="${!TAG?'active':''}"><a href="${preserve({tags:''})}">Todos</a></li>`,
    ...FAMILIES.map(name=>{
      const s=slug(name), active = TAG===s?'active':'';
      return `<li class="${active}"><a href="${preserve({tags:s})}">${name}</a></li>`;
    })
  ].join('');
  box.innerHTML = `<ul class="filter-list">${list}</ul>`;
}

function apply(pushURL){
  let items = PRODUCTS.filter(p=>{
    if (['hombre','mujer','unisex'].includes(CATEGORY)) return (p.gender||'').toLowerCase()===CATEGORY;
    if (CATEGORY==='nicho') return hasTag(p,'nicho');
    return true;
  });
  if (TAG) items = items.filter(p=> hasTag(p,TAG));
  items.sort(sorter(SORT));

  const total = items.length, pages = Math.max(1, Math.ceil(total/PER));
  PAGE = Math.min(Math.max(1,PAGE), pages);
  const start = (PAGE-1)*PER, paged = items.slice(start, start+PER);

  render(paged);
  renderPager(pages, PAGE);

  EMPTY.hidden = paged.length>0;
  RESULTS && (RESULTS.textContent = `${total} resultado${total!==1?'s':''}`);

  const curView = new URLSearchParams(location.search).get('view') || 'grid';
  GRID?.classList.toggle('is-list', curView==='list');

  if (pushURL){
    const q = new URLSearchParams();
    if (CATEGORY!=='all') q.set('cat',CATEGORY);
    if (curView!=='grid') q.set('view',curView);
    if (PER!==30) q.set('per', String(PER));
    if (PAGE!==1) q.set('page', String(PAGE));
    if (SORT!=='default') q.set('sort', SORT);
    if (TAG) q.set('tags', TAG);
    history.replaceState(null,'',`?${q.toString()}`);
  }
}

function sorter(k){
  const num = x=>Number(x||0), isOffer = p=>p.listPrice && p.price < p.listPrice;
  switch(k){
    case 'priceAsc':  return (a,b)=>num(a.price)-num(b.price);
    case 'priceDesc': return (a,b)=>num(b.price)-num(a.price);
    case 'nameAsc':   return (a,b)=>(`${a.brand} ${a.name}`).localeCompare(`${b.brand} ${b.name}`,'es');
    case 'nameDesc':  return (a,b)=>(`${b.brand} ${b.name}`).localeCompare(`${a.brand} ${a.name}`,'es');
    case 'offer':     return (a,b)=>(isOffer(b)-isOffer(a)) || (num(a.price)-num(b.price));
    default:          return ()=>0;
  }
}

function render(items){
  GRID.innerHTML = items.map(p=>{
    const hasOffer = p.listPrice && p.price < p.listPrice;
    return `
      <article class="card" data-id="${p.id}">
        <!-- link SOLO en la imagen -->
        <a class="card-link" href="product.html?id=${p.id}" aria-label="${p.brand} ${p.name}">
          <div class="card__img">
            <img src="${p.image || '/assets/placeholder.webp'}" alt="${p.brand} ${p.name}" loading="lazy"
                 onerror="this.onerror=null;this.src='/assets/placeholder.webp'">
          </div>
        </a>

        <div class="card__body">
          <!-- tags (se muestran en LISTA por CSS) -->
          <div class="card__tags">${(p.tags||[]).join(', ')}</div>

          <div class="card__title">${p.brand} · ${p.name}</div>

          <div class="card__meta">
            <span class="muted">${p.size || '100ml'} · ${p.gender || ''}</span>
            ${hasOffer ? `<span class="badge">Oferta</span>` : ``}
          </div>

          <div class="price-row">
            <span class="price">${money(p.price)}</span>
            ${hasOffer ? `<span class="list">${money(p.listPrice)}</span>` : ``}
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
    `;
  }).join('');

  GRID.querySelectorAll('[data-cart]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-cart');
      window.Cart?.add(id,1);
    });
  });
}

function renderPager(pages, current){
  if (!PAGER) return;
  if (pages<=1){ PAGER.innerHTML=''; return; }

  const windowSize = 2;
  let html = '';
  const link = (p, cls='', label=p)=>`<a href="#" data-page="${p}" class="${cls}">${label}</a>`;

  html += link(Math.max(1,current-1), current===1?'disabled':'', '«');

  let last = 0;
  for (let i=1;i<=pages;i++){
    if (i===1 || i===pages || (i>=current-windowSize && i<=current+windowSize)){
      if (i-last>1) html += `<span class="pager-gap" style="padding:0 6px;">…</span>`;
      html += link(i, i===current?'active':'', i);
      last = i;
    }
  }

  html += link(Math.min(pages,current+1), current===pages?'disabled':'', '»');
  PAGER.innerHTML = html;

  PAGER.querySelectorAll('a[data-page]').forEach(a=>{
    a.addEventListener('click', e=>{
      e.preventDefault();
      const p = parseInt(a.dataset.page,10);
      if (isNaN(p)) return;
      PAGE = p; apply(true); window.scrollTo({top:0, behavior:'smooth'});
    });
  });
}

function bind(){
  PERSEL?.addEventListener('change', ()=>{ PER=parseInt(PERSEL.value,10)||30; PAGE=1; apply(true); });
  SORTSEL?.addEventListener('change', ()=>{ 
    const map={default:'default', priceAsc:'priceAsc', priceDesc:'priceDesc', nameAsc:'nameAsc', nameDesc:'nameDesc', offer:'offer'};
    SORT = map[SORTSEL.value] || 'default'; PAGE=1; apply(true);
  });

  window.addEventListener('popstate', ()=>{ parseURL(); apply(false); });

  document.querySelector('.nav-toggle')?.addEventListener('click', ()=>{
    const nav = document.querySelector('.nav');
    nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
  });
}
