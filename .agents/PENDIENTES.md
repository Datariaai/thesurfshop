# PENDIENTES — thesurfshop.ar
**Ultima actualizacion:** 2-nov-2026
**Estado:** Activo
**Que es:** Tienda pública (`index.html`, pedidos por WhatsApp) + ERP de stock (`stock.html`) de boardshorts vintage (Billabong / Quiksilver) para thesurfshop.ar, pensado para celular.
**Donde vive:** repo `https://github.com/Datariaai/thesurfshop` (público) | publicado en `https://datariaai.github.io/thesurfshop/` (GitHub Pages, rama `sistema-stock`)

## 2-nov-2026 — Felipe

### Hecho
- ERP en `stock.html` con los colores del logo (amarillo flúor y rosa sobre azul océano). Panel izquierdo con 4 módulos:
  - **Stock:** tabla por modelo y talle con el encabezado fijo; en el celular, un casillero por talle con la cantidad grande. KPIs: unidades, agotados, costo del stock y valor de venta. Crear y editar modelos (con costo, precio y foto).
  - **Ingresos:** varios modelos y talles por carga, con costo por unidad y talle. Se pueden agregar talles nuevos ("+ otro") y crear un modelo nuevo desde el mismo cartel. El último costo queda en el modelo y se sugiere.
  - **Egresos:** cada egreso es una venta, con precio por talle. Solo deja tocar los talles con stock y no deja sacar más de lo que hay.
  - **Ventas:** se arma sola con los egresos (facturado, unidades, ventas, ticket promedio, detalle por modelo; hoy / 7 días / mes / todo).
  - Deshacer durante 7 segundos después de cada carga.
- 15 modelos iniciales armados con las fotos del cliente (`js/catalogo-inicial.js`, `img/fotos/`). Arrancan con stock 0 y nombres provisorios.
- Entrada con un solo botón "Entrar" mientras no esté Firebase. Con Firebase, la entrada pide email y contraseña.
- PR #1: https://github.com/Datariaai/thesurfshop/pull/1 (sin mergear; lo mergea Imanol).
- El repo se pasó a **público** y se publicó con GitHub Pages desde `sistema-stock` (como mpcatering de Felipe), para tener un link y mandarlo por WhatsApp. `index.html` redirige a `stock.html`.

### Pendiente
- [ ] **Firebase:** crear el proyecto, pasar el email de la clienta, poner los datos en `js/firebase-config.js` y el email en `firestore.rules` (pasos en el README). Hasta entonces cada navegador guarda su propio stock (localStorage): sirve para mostrar, no para trabajar.
- [ ] Al conectar Firebase, agregar `datariaai.github.io` (o el dominio final) en Authentication → Dominios autorizados.
- [ ] Imanol: decidir si el repo queda público con GitHub Pages o vuelve a privado con Vercel (es una excepción a la regla de repos privados de los clientes).
- [ ] Confirmar con la clienta los nombres de los 15 modelos (los inventamos) y los talles (pusimos 28 a 38).
- [x] Página pública de la tienda (hecha el 2-nov a la tarde, ver abajo).
- [ ] Idea ofrecida a Felipe: ganancia (precio − costo) por modelo en Ventas. No pedida todavía.

### Trampas
- Los JS son scripts comunes (no módulos) para que `stock.html` abra con doble clic. No pasarlos a `type="module"`.
- El modo sin Firebase guarda en `localStorage` con la clave `tss-demo-v3`; la sesión dura lo que la pestaña (`sessionStorage`).
- Cada push a `sistema-stock` republica el link en 1-2 minutos. Si se mergea a `main`, hay que cambiar la rama de GitHub Pages a `main`.
- Desde Claude Code, crear repos o cambiar la visibilidad lo bloquea el clasificador de permisos: hay que pasarle los comandos a Felipe para que los pegue en la terminal. El `git push` normal sí anda.
- Los originales pesados (fotos de WhatsApp, capturas, logo en PDF) están en `_material/`, que no se sube. Falta pasarlos a Drive → "Dataria - Medios".

## 2-nov-2026 (tarde) — Felipe: tienda pública

### Hecho
- Tienda en `index.html` (rama `web-publica`), inspirada en un video de TikTok que pasó Felipe (ropa colgada en un perchero que gira):
  - **Perchero:** las 15 mallas cuelgan de perchas con pinzas en un barral curvo, sobre la foto del mar del logo. La del medio grande, las de los costados más chicas. Se pasa con flechas, deslizando, con el teclado o tocando una de los costados. Filtro Billabong / Quiksilver.
  - **Balanceo con física:** las mallas se mueven al pasar el mouse o el dedo, al arrastrarlas y cuando gira el perchero.
  - **Panel** de la malla: fotos reales (se agrandan), selector de talle (píldora con perilla amarilla), "Agregar al carrito".
  - **Carrito** (se guarda en el navegador, clave `tss-carrito-v1`) → botón "Pedir por WhatsApp" con el pedido armado al **+54 9 11 6508-9999**.
  - Onda del Instagram: nombres con la letra del logo, cinta rosa con la bio, pie de océano con "Envíos a todo el país".
- Recortes sin fondo de las mallas en `img/percha/<id>.webp` (hechos con rembg en la compu de Felipe, a partir de `img/fotos/`). Navy usa la foto 39 girada porque la 37 está doblada.
- Foto del mar `img/mar.webp`: es la foto original del logo, sacada del PDF `_material/bauti mallas.pdf`.
- WhatsApp, precios y modelos ocultos se cambian en un solo lugar: `js/tienda-config.js`.

### Pendiente
- [ ] **Precios:** ningún modelo tiene precio; la web dice "Consultar precio". Cargarlos en `js/tienda-config.js` (`precios: { 'bb-gold-dots': 45000, ... }`).
- [ ] Que la clienta vea y apruebe la web. Después, sacar el `<meta name="robots" content="noindex">` de `index.html`.
- [ ] Al mergear: la dirección principal pasa a abrir la tienda (antes redirigía al ERP). El ERP queda en `.../stock.html`: avisarle a la clienta.
- [ ] Si se agrega un modelo nuevo a la web, hace falta su recorte en `img/percha/<id>.webp` (si no está, se muestra la foto con fondo).

### Trampas
- La tienda lee el catálogo de `js/catalogo-inicial.js` (el mismo del ERP), no el stock real de Firebase: es un catálogo fijo, como pidió Felipe.
- `js/tienda.js` también es script común (no módulo): `index.html` abre con doble clic.
- La rama `web-publica` sale de `sistema-stock`, así que su PR a `main` incluye también lo del PR #1.
