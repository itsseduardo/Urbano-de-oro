# Urbano de Oro — E-commerce de Perfumes

Sitio web (front-end) para **Urbano de Oro**.  
Incluye home con banners/categorías, catálogo con filtros, ficha de producto, carrito local, “Nuevos lanzamientos”, “Ofertas” y un panel admin (protegido) para cargar productos e imágenes en **Supabase**.

## ✨ Características
- **Catálogo** con paginación, orden y vista **grid/lista**.
- **Filtros** por categoría y por tags (familias olfativas).
- **Tendencias** dinámicas (tabla `trending` en Supabase).
- **Ofertas** con `list_price` y `offer_ends_at`.
- **Ficha de producto** con WhatsApp CTA y carrito.
- **Carrito** con `localStorage`.
- **Admin** (login con Supabase) para crear/editar productos y subir imágenes a **Supabase Storage** (URL pública).

## 🧱 Stack
- HTML, CSS, JavaScript (vanilla)
- [Supabase](https://supabase.com/) (DB Postgres + Auth + Storage)
- GitHub Pages / Netlify / Vercel para hosting estático (opcional)

## 📁 Estructura
├─ index.html
├─ category.html
├─ product.html
├─ nuevos.html
├─ ofertas.html
├─ admin.html
├─ login.html
├─ /assets # imágenes y estáticos
├─ /data # (opcional) fuentes de datos locales
├─ styles.css
├─ supabaseClient.js
├─ main.js
├─ category.js
├─ product.js
├─ nuevos.js
├─ ofertas.js
└─ cart.js


## ⚙️ Configuración
1. Crea un proyecto en **Supabase** y las tablas `products`, `trending`, `profiles`.  
2. En **Storage**, crea un bucket `products` **público** (para imágenes).  
3. **RLS** activado y políticas solo lectura para `anon`, escritura para usuarios autenticados en `admin`.  
4. En `supabaseClient.js`, coloca:
   ```js
   export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

