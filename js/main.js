import { supabase } from '/js/supabaseClient.js';

const YEAR = document.getElementById('year');
if (YEAR) YEAR.textContent = new Date().getFullYear();

initHome();

async function initHome(){
  try{
    const trending = await loadTrending();   // ← orden desde tabla 'trending'
    renderTrending(trending);
    wireCategoryCards();
  }catch(e){
    console.error('Error inicializando home:', e);
  }
}

async function loadTrending(){
  const { data: t, error: e1 } = await supabase
    .from('trending').select('id, order_index').order('order_index');
  if (e1) throw e1;

  const ids = (t||[]).map(x=>x.id);
  if (!ids.length) return [];

  const { data: all, error: e2 } = await supabase
    .from('products')
    .select('id,brand,name,gender,size,price,list_price,tags,image,images')
    .in('id', ids);
  if (e2) throw e2;

  const map = new Map((all||[]).map(p=>[p.id, { ...p, listPrice: p.list_price }]));
  return ids.map(id => map.get(id)).filter(Boolean); // respeta el orden del carrusel
}

function formatCOP(n) {
  return (n ?? 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

function trendCardTemplate(p) {
  const hasOffer = p.listPrice && p.price < p.listPrice;
  return `
    <article class="trend-card card" data-id="${p.id}">
      <a class="card-link" href="product.html?id=${p.id}" aria-label="${p.brand} ${p.name}">
        <div class="card__img">
          <img src="${p.image}" alt="${p.brand} ${p.name}" loading="lazy"
               onerror="this.onerror=null;this.src='/assets/placeholder.webp';">
          <span class="price-tag">${formatCOP(p.price)}</span>
        </div>
        <div class="card__body">
          <div class="card__title">${p.brand} · ${p.name}</div>
          <div class="card__meta">
            <span class="muted">${p.size || '100ml'} · ${p.gender || ''}</span>
            ${hasOffer ? `<span class="badge">Oferta</span>` : ``}
          </div>
        </div>
      </a>

      <div class="card__body">
        <div class="card__actions">
          <button class="btn btn--primary" data-cart="${p.id}">Añadir al carrito</button>
        </div>
      </div>
    </article>
  `;
}

function renderTrending(items) {
  const track = document.getElementById('trendTrack');
  const dots = document.getElementById('trendDots');
  if (!track) return;

  if (!items.length){
    track.innerHTML = '';
    dots && (dots.innerHTML = '');
    return;
  }

  track.innerHTML = items.map(trendCardTemplate).join('');

  // Añadir al carrito
  track.querySelectorAll('[data-cart]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-cart');
      window.Cart?.add(id,1);
    });
  });

  // Flechas
  const prev = document.querySelector('.trend-btn.prev');
  const next = document.querySelector('.trend-btn.next');
  const jump = () => Math.max(280, track.clientWidth * 0.9);
  prev?.addEventListener('click', () => track.scrollBy({ left: -jump(), behavior: 'smooth' }));
  next?.addEventListener('click', () => track.scrollBy({ left:  jump(), behavior: 'smooth' }));

  // Dots
  if (dots){
    const pages = () => Math.max(1, Math.ceil(track.scrollWidth / track.clientWidth));
    const page = () => Math.round(track.scrollLeft / track.clientWidth);
    const paint = () => dots.innerHTML = Array.from({ length: pages() })
      .map((_, i) => `<span class="trend-dot${i === page() ? ' active' : ''}"></span>`).join('');
    const update = () => Array.from(dots.children).forEach((d, i) => d.classList.toggle('active', i === page()));

    paint();
    track.addEventListener('scroll', update);
    window.addEventListener('resize', paint);
  }
}

// (Opcional) si tu rejilla "Categorías" ya está en la home, conecta enlaces limpios
function wireCategoryCards() {
  document.querySelectorAll('.fam-card').forEach(card => {
    if (!card.getAttribute('href')) card.addEventListener('click', e => e.preventDefault());
  });
}

// menú mobile
document.querySelector('.nav-toggle')?.addEventListener('click', () => {
  const nav = document.querySelector('.nav');
  nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
});
