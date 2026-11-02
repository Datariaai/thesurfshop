(function () {
const { CATALOGO_INICIAL, TIENDA } = window.TSS;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plata = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const pesos = n => plata.format(n || 0);
const esCelu = () => matchMedia('(max-width: 760px)').matches;
const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const vibrar = () => navigator.vibrate?.(10);

const precioDe = m => TIENDA.precios[m.id] ?? m.precio ?? null;
const recorte = m => `img/percha/${m.id}.webp`;

// Percha con pinzas (para mallas): gancho, barra y dos pinzas que agarran la cintura.
const PERCHA_SVG = `
<svg class="percha" viewBox="0 0 200 64" aria-hidden="true">
  <path d="M100 34V22c0-5 8-6 8-13a8 8 0 0 0-16 0" fill="none" stroke="#9aa4ac" stroke-width="3" stroke-linecap="round"/>
  <rect x="12" y="30" width="176" height="8" rx="4" fill="#1f2d3a"/>
  <rect x="12" y="30" width="176" height="2.5" rx="1.25" fill="#3a4b5a"/>
  <rect x="24" y="35" width="14" height="27" rx="2.5" fill="#26313b"/>
  <rect x="162" y="35" width="14" height="27" rx="2.5" fill="#26313b"/>
  <path d="M27 44h8M165 44h8" stroke="#aeb7be" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const escenario = $('#escenario');
const contenedor = $('#perchas');
const panel = $('#panel');

let lista = [];        // modelos visibles (según el filtro)
let perchas = [];      // { el, pendulo, ang, vel }
let pos = 0;           // posición del perchero (puede tener decimales mientras gira)
let objetivo = 0;      // a qué malla va
let velPerchero = 0;
let detalle = 0;       // 0 = perchero, 1 = panel abierto (animado)
let enDetalle = false;
let talleElegido = null;
let medidas = {};

/* ---------- Armado del perchero ---------- */
function armar(marca) {
  lista = CATALOGO_INICIAL.filter(m => !TIENDA.ocultos.includes(m.id) && (!marca || m.marca === marca));
  contenedor.innerHTML = lista.map((m, i) => `
    <button class="colgada" data-i="${i}" aria-label="${esc(m.marca)} ${esc(m.nombre)}">
      <div class="pendulo">
        <span class="alambre"></span>
        ${PERCHA_SVG}
        <img class="malla" src="${recorte(m)}" alt="" draggable="false" data-foto="${esc(m.fotos[0])}">
      </div>
    </button>`).join('');
  perchas = [...contenedor.children].map(el => ({ el, pendulo: el.firstElementChild, ang: (Math.random() - 0.5) * 8, vel: 0 }));
  // Si una malla todavía no tiene recorte, se muestra la foto.
  contenedor.querySelectorAll('.malla').forEach(img => img.addEventListener('error', () => { img.src = img.dataset.foto; }, { once: true }));
  pos = objetivo = 0;
  medir();
  mostrarEtiqueta();
}

const cantidad = () => lista.length;
const indice = n => ((Math.round(n) % cantidad()) + cantidad()) % cantidad();
const actual = () => lista[indice(objetivo)];

// Distancia de cada malla al centro, dando la vuelta (el perchero es infinito).
function distancia(i, p) {
  const n = cantidad();
  return ((((i - p) % n) + n * 1.5) % n) - n / 2;
}

function medir() {
  const W = escenario.clientWidth, H = escenario.clientHeight;
  const celu = esCelu();
  const ancho = celu ? Math.min(W * 0.62, H * 0.42) : Math.min(W * 0.28, H * 0.5, 380);
  medidas = {
    W, H, celu, ancho,
    paso: celu ? W * 0.52 : Math.max(ancho * 0.78, W * 0.2),
    y0: celu ? 54 : 62,
    comba: H * (celu ? 0.03 : 0.055),
    visibles: celu ? 1.6 : 2.6,
  };
  escenario.style.setProperty('--ancho', `${ancho}px`);
  escenario.style.setProperty('--alambre', `${Math.round(H * (celu ? 0.05 : 0.07))}px`);

  const { y0, comba } = medidas;
  const d = `M -10 ${y0} Q ${W / 2} ${y0 + comba * 2} ${W + 10} ${y0}`;
  $('#barral').setAttribute('viewBox', `0 0 ${W} ${H}`);
  $('#barral-tubo').setAttribute('d', d);
  $('#barral-sombra').setAttribute('d', d);
  $('#barral-sombra').setAttribute('transform', 'translate(0 7)');
}

// Altura del barral en cada punto (es una curva que baja un poco en el medio).
function alturaBarral(x) {
  const { W, y0, comba } = medidas;
  const u = Math.min(1, Math.max(0, x / W));
  return y0 + 4 * comba * u * (1 - u);
}

/* ---------- Animación: giro del perchero + balanceo de cada malla ---------- */
let antes = performance.now();
function cuadro(ahora) {
  const dt = Math.min(0.05, (ahora - antes) / 1000);
  antes = ahora;

  // El perchero va hacia la malla elegida como un resorte.
  if (!arrastre.activo) {
    const fuerza = (objetivo - pos) * 90 - velPerchero * 16;
    const velAntes = velPerchero;
    velPerchero += fuerza * dt;
    pos += velPerchero * dt;
    if (sinMovimiento) { pos = objetivo; velPerchero = 0; }
    empujarTodas(velPerchero - velAntes);
  }
  detalle += ((enDetalle ? 1 : 0) - detalle) * Math.min(1, dt * 9);

  const { W, celu, paso, visibles } = medidas;
  perchas.forEach((p, i) => {
    // Péndulo con rozamiento: vuelve solo a quedar derecho.
    p.vel += (-55 * p.ang - 2.6 * p.vel) * dt;
    p.ang = Math.max(-28, Math.min(28, p.ang + p.vel * dt));
    if (sinMovimiento) { p.ang = 0; p.vel = 0; }

    const d = distancia(i, pos);
    const a = Math.abs(d);
    let x = Math.sign(d) * paso * (a <= 1 ? a : 1 + (a - 1) * 0.82);
    let s = a <= 1 ? 1 - 0.4 * a : Math.max(0.3, 0.6 - 0.16 * (a - 1));
    let o = Math.max(0, Math.min(1, visibles + 0.4 - a));

    // Con el panel abierto, la malla elegida se corre al costado y las demás se esconden.
    if (detalle > 0.001) {
      const esta = a < 0.5;
      const xD = celu ? 0 : -W * 0.2;
      const sD = celu ? 0.62 : 1.12;
      if (esta) { x += (xD - x) * detalle; s += (sD - s) * detalle; }
      else o *= 1 - detalle;
    }
    const top = alturaBarral(W / 2 + x) - 3;
    p.el.style.transform = `translate(${x.toFixed(1)}px, ${top.toFixed(1)}px) scale(${s.toFixed(3)})`;
    p.el.style.opacity = o.toFixed(3);
    p.el.style.zIndex = String(100 - Math.round(a * 10));
    p.el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    p.el.classList.toggle('centro', a < 0.5);
    p.el.tabIndex = a < 0.5 ? 0 : -1;
    p.pendulo.style.transform = `rotate(${p.ang.toFixed(2)}deg)`;
  });
  requestAnimationFrame(cuadro);
}

// Cuando el perchero acelera, las mallas se quedan atrás y se balancean.
function empujarTodas(cambio) {
  if (!cambio) return;
  perchas.forEach(p => { p.vel += cambio * 32; });
}

function ir(n) {
  if (enDetalle || !cantidad()) return;
  objetivo = Math.round(n);
  mostrarEtiqueta();
  vibrar();
}

function mostrarEtiqueta() {
  const m = actual();
  if (!m) return;
  $('#etiqueta-marca').textContent = `${m.marca} · ${String(indice(objetivo) + 1).padStart(2, '0')} / ${String(cantidad()).padStart(2, '0')}`;
  $('#etiqueta-nombre').textContent = m.nombre;
  const precio = precioDe(m);
  $('#etiqueta-precio').textContent = precio ? pesos(precio) : 'Consultar precio';
}

/* ---------- Arrastrar, tocar y pasar el mouse ---------- */
const arrastre = { activo: false, x0: 0, pos0: 0, ultX: 0, ultT: 0, vel: 0, movio: false, percha: null };

escenario.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.target.closest('.panel, .flecha, .etiqueta')) return;
  const el = e.target.closest('.colgada');
  Object.assign(arrastre, {
    activo: !enDetalle, x0: e.clientX, pos0: pos, ultX: e.clientX, ultT: e.timeStamp, vel: 0, movio: false,
    percha: el ? perchas[+el.dataset.i] : null,
  });
  if (arrastre.activo) velPerchero = 0;
});

window.addEventListener('pointermove', e => {
  // Pasar el mouse (o el dedo) por una malla la hace balancear.
  const el = e.target.closest?.('.colgada');
  if (el && !arrastre.movio) perchas[+el.dataset.i].vel -= e.movementX * 1.4;

  if (arrastre.percha && enDetalle && e.buttons) {
    arrastre.percha.vel -= e.movementX * 3;
    arrastre.movio = true;
    return;
  }
  if (!arrastre.activo) return;
  const dx = e.clientX - arrastre.x0;
  if (!arrastre.movio && Math.abs(dx) < 8) return;
  if (!arrastre.movio) { arrastre.movio = true; escenario.classList.add('arrastrando'); }
  const antesPos = pos;
  pos = arrastre.pos0 - dx / medidas.paso;
  const dt = Math.max(1, e.timeStamp - arrastre.ultT) / 1000;
  const v = (pos - antesPos) / dt;
  empujarTodas((v - arrastre.vel) * 0.25);
  arrastre.vel = v;
  arrastre.ultT = e.timeStamp;
});

window.addEventListener('pointerup', () => {
  if (arrastre.activo && arrastre.movio) {
    velPerchero = arrastre.vel;
    ir(pos + Math.max(-2, Math.min(2, arrastre.vel * 0.12)));
  }
  escenario.classList.remove('arrastrando');
  arrastre.activo = false;
  arrastre.percha = null;
  // El "click" que viene después de arrastrar no tiene que abrir nada.
  if (arrastre.movio) setTimeout(() => { arrastre.movio = false; }, 0);
});

contenedor.addEventListener('click', e => {
  const el = e.target.closest('.colgada');
  if (!el || arrastre.movio) return;
  const i = +el.dataset.i;
  const d = distancia(i, objetivo);
  if (Math.abs(d) < 0.5) {
    if (enDetalle) perchas[i].vel += 120;
    else abrirDetalle();
  } else {
    ir(objetivo + d);
  }
});

$('#anterior').addEventListener('click', () => ir(objetivo - 1));
$('#siguiente').addEventListener('click', () => ir(objetivo + 1));
$('#ver-malla').addEventListener('click', abrirDetalle);
$('#cerrar-panel').addEventListener('click', cerrarDetalle);

document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || e.target.matches('input')) return;
  if (e.key === 'ArrowLeft') ir(objetivo - 1);
  if (e.key === 'ArrowRight') ir(objetivo + 1);
  if (e.key === 'Escape' && enDetalle) cerrarDetalle();
});

document.querySelectorAll('.filtro').forEach(b => b.addEventListener('click', () => {
  if (enDetalle) cerrarDetalle();
  document.querySelectorAll('.filtro').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
  armar(b.dataset.marca);
}));

let esperaMedir;
window.addEventListener('resize', () => {
  clearTimeout(esperaMedir);
  esperaMedir = setTimeout(medir, 80);
});

/* ---------- Panel de la malla ---------- */
function abrirDetalle() {
  const m = actual();
  if (!m) return;
  objetivo = Math.round(objetivo);
  enDetalle = true;
  escenario.classList.add('detalle');
  perchas[indice(objetivo)].vel += 90;
  talleElegido = null;

  const precio = precioDe(m);
  $('#panel-rotulo').textContent = `${m.marca} · ${String(indice(objetivo) + 1).padStart(2, '0')} / ${String(cantidad()).padStart(2, '0')}`;
  $('#panel-nombre').textContent = m.nombre;
  $('#panel-precio').textContent = precio ? pesos(precio) : 'Consultar precio';
  $('#panel-precio-nota').textContent = precio ? 'ARS' : 'te lo pasamos por WhatsApp';
  $('#panel-color').textContent = m.color;
  $('#panel-marca-detalle').textContent = m.marca;
  $('#panel-fotos').innerHTML = m.fotos.map((f, i) =>
    `<button class="foto" data-foto="${esc(f)}" aria-label="Ver foto ${i + 1}"><img src="${esc(f)}" alt="" loading="lazy"></button>`).join('');

  const talles = $('#talles');
  talles.classList.remove('con-talle');
  talles.querySelectorAll('.talle').forEach(b => b.remove());
  talles.insertAdjacentHTML('beforeend', Object.keys(m.talles).map(t =>
    `<button class="talle" role="radio" aria-checked="false" data-talle="${esc(t)}">${esc(t)}</button>`).join(''));
  actualizarBotonAgregar();

  panel.hidden = false;
  panel.scrollTop = 0;
  $('#cerrar-panel').focus({ preventScroll: true });
}

function cerrarDetalle() {
  enDetalle = false;
  escenario.classList.remove('detalle');
  panel.hidden = true;
  const centro = perchas[indice(objetivo)];
  if (centro) { centro.vel -= 60; centro.el.focus({ preventScroll: true }); }
}

$('#talles').addEventListener('click', e => {
  const b = e.target.closest('.talle');
  if (!b) return;
  talleElegido = b.dataset.talle;
  const talles = $('#talles');
  talles.querySelectorAll('.talle').forEach(o => o.setAttribute('aria-checked', String(o === b)));
  talles.classList.add('con-talle');
  talles.style.setProperty('--w', `${b.offsetWidth}px`);
  talles.style.setProperty('--x', `${b.offsetLeft - 4}px`);
  perchas[indice(objetivo)].vel += 40;
  actualizarBotonAgregar();
  vibrar();
});

function actualizarBotonAgregar() {
  const m = actual();
  const precio = precioDe(m);
  $('#panel-talle').textContent = talleElegido || '—';
  $('#agregar').disabled = !talleElegido;
  $('#agregar-texto').textContent = talleElegido ? `Agregar al carrito · ${talleElegido}` : 'Elegí un talle';
  $('#agregar-precio').textContent = talleElegido && precio ? pesos(precio) : '';
}

$('#agregar').addEventListener('click', () => {
  const m = actual();
  if (!m || !talleElegido) return;
  agregar(m.id, talleElegido);
  avisar(`${m.nombre} talle ${talleElegido} al carrito`);
  const boton = $('#abrir-carrito');
  boton.classList.remove('salto');
  void boton.offsetWidth;
  boton.classList.add('salto');
  perchas[indice(objetivo)].vel -= 140;
});

$('#panel-fotos').addEventListener('click', e => {
  const b = e.target.closest('.foto');
  if (!b) return;
  $('#visor-img').src = b.dataset.foto;
  $('#visor').showModal();
});
$('#cerrar-visor').addEventListener('click', () => $('#visor').close());
$('#visor').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });

/* ---------- Carrito ---------- */
const CLAVE = 'tss-carrito-v1';
let carrito = [];
try { carrito = JSON.parse(localStorage.getItem(CLAVE)) || []; } catch { carrito = []; }
carrito = carrito.filter(it => CATALOGO_INICIAL.some(m => m.id === it.id));

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(carrito)); } catch { /* sin almacenamiento: el carrito dura lo que la pestaña */ }
  pintarCarrito();
}

function agregar(id, talle) {
  const it = carrito.find(x => x.id === id && x.talle === talle);
  if (it) it.cant += 1;
  else carrito.push({ id, talle, cant: 1 });
  guardar();
}

const modelo = id => CATALOGO_INICIAL.find(m => m.id === id);

function pintarCarrito() {
  const unidades = carrito.reduce((s, it) => s + it.cant, 0);
  $('#carrito-cuenta').textContent = `(${unidades})`;
  $('#carrito-vacio').hidden = carrito.length > 0;
  $('#form-pedido').hidden = carrito.length === 0;
  $('#carrito-lista').innerHTML = carrito.map((it, i) => {
    const m = modelo(it.id);
    const precio = precioDe(m);
    return `
      <li class="item">
        <img src="${recorte(m)}" alt="">
        <div>
          <p class="item-nombre">${esc(m.nombre)}</p>
          <p class="item-datos">${esc(m.marca)} · Talle ${esc(it.talle)} · ${precio ? pesos(precio * it.cant) : 'Consultar'}</p>
        </div>
        <div class="item-lado">
          <div class="cantidad">
            <button data-accion="menos" data-i="${i}" aria-label="Uno menos">−</button>
            <span>${it.cant}</span>
            <button data-accion="mas" data-i="${i}" aria-label="Uno más">+</button>
          </div>
          <button class="quitar" data-accion="quitar" data-i="${i}">Quitar</button>
        </div>
      </li>`;
  }).join('');
  const sinPrecio = carrito.some(it => !precioDe(modelo(it.id)));
  const total = carrito.reduce((s, it) => s + (precioDe(modelo(it.id)) || 0) * it.cant, 0);
  $('#carrito-total').textContent = total ? pesos(total) + (sinPrecio ? ' + a confirmar' : '') : 'A confirmar';
  $('#carrito-nota').hidden = !sinPrecio;
}

$('#carrito-lista').addEventListener('click', e => {
  const b = e.target.closest('[data-accion]');
  if (!b) return;
  const it = carrito[+b.dataset.i];
  if (b.dataset.accion === 'mas') it.cant += 1;
  if (b.dataset.accion === 'menos') it.cant -= 1;
  if (b.dataset.accion === 'quitar' || it.cant <= 0) carrito.splice(+b.dataset.i, 1);
  guardar();
});

const dialogoCarrito = $('#carrito');
$('#abrir-carrito').addEventListener('click', () => dialogoCarrito.showModal());
$('#cerrar-carrito').addEventListener('click', () => dialogoCarrito.close());
dialogoCarrito.addEventListener('click', e => { if (e.target === dialogoCarrito) dialogoCarrito.close(); });

$('#form-pedido').addEventListener('submit', e => {
  e.preventDefault();
  if (!carrito.length) return;
  const datos = new FormData(e.currentTarget);
  const nombre = String(datos.get('nombre') || '').trim();
  const zona = String(datos.get('zona') || '').trim();
  const lineas = carrito.map(it => {
    const m = modelo(it.id);
    const precio = precioDe(m);
    return `• ${m.marca} ${m.nombre} — talle ${it.talle} × ${it.cant}${precio ? ` — ${pesos(precio * it.cant)}` : ''}`;
  });
  const sinPrecio = carrito.some(it => !precioDe(modelo(it.id)));
  const total = carrito.reduce((s, it) => s + (precioDe(modelo(it.id)) || 0) * it.cant, 0);
  const texto = [
    '¡Hola thesurfshop.ar! Quiero hacer este pedido:',
    '',
    ...lineas,
    '',
    total ? `Total: ${pesos(total)}${sinPrecio ? ' + lo que falta confirmar' : ''}` : '¿Me pasás los precios?',
    nombre ? `Nombre: ${nombre}` : null,
    zona ? `Envío a: ${zona}` : null,
    '',
    '¿Cómo seguimos con el pago y el envío?',
  ].filter(l => l !== null).join('\n');
  window.open(`https://wa.me/${TIENDA.whatsapp}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
});

/* ---------- Varios ---------- */
let esperaAviso;
function avisar(texto) {
  const a = $('#aviso');
  a.textContent = texto;
  a.hidden = false;
  clearTimeout(esperaAviso);
  esperaAviso = setTimeout(() => { a.hidden = true; }, 2200);
}

$('#link-instagram').href = `https://www.instagram.com/${TIENDA.instagram}/`;
$('#link-whatsapp').href = `https://wa.me/${TIENDA.whatsapp}`;

armar('');
pintarCarrito();
requestAnimationFrame(cuadro);
})();
