(async function () {
const { ordenarTalles, totalModelo, fotoPrincipal, TALLES_BASE } = window.TSS;
let datos;
try {
  datos = await window.TSS.datos;
} catch {
  document.getElementById('login').hidden = false;
  document.getElementById('login-nota').textContent = 'No se pudo conectar. Revisá internet y recargá la página.';
  return;
}

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const normalizar = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const vibrar = () => navigator.vibrate?.(12);
const esCompu = () => matchMedia('(min-width: 700px)').matches;
const plata = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const pesos = n => plata.format(n || 0);
const entero = v => Math.max(0, Math.floor(Number(v) || 0));

const TALLES_OPCIONES = ['26', '28', '30', '32', '34', '36', '38', '40', 'S', 'M', 'L', 'XL'];
// tipo "alta" = ingreso de mercadería (lleva costo por talle), "baja" = egreso: cada egreso es una venta (lleva precio por talle).
const ICONO_EDITAR = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg>';
const ICONO_CERRAR = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

let modelos = [];
let movs = [];
let modelosCargados = false;
let vista = 'stock';
let busqueda = '';
let periodo = 'mes';
let desuscribir = [];

const modeloPorId = id => modelos.find(m => m.id === id);

// ---------------------------------------------------------------- ingreso al sistema

datos.onUsuario(u => (u ? iniciarApp(u) : mostrarLogin()));

function mostrarLogin() {
  desuscribir.forEach(f => f());
  desuscribir = [];
  $('#app').hidden = true;
  $('#login').hidden = false;
}

$('#form-login').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const boton = e.target.querySelector('button');
  boton.disabled = true;
  $('#login-error').textContent = '';
  try {
    await datos.entrar(f.get('email').trim(), f.get('clave'));
  } catch (err) {
    const c = err?.code || '';
    $('#login-error').textContent =
      c.includes('too-many') ? 'Demasiados intentos. Esperá unos minutos.' :
      c.includes('network') ? 'No hay conexión. Probá de nuevo.' :
      'Email o contraseña incorrectos.';
  } finally {
    boton.disabled = false;
  }
});

$('#btn-salir').addEventListener('click', () => {
  if (confirm('¿Cerrar sesión en este dispositivo?')) datos.salir();
});

function iniciarApp(usuario) {
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#panel-usuario').textContent = usuario.email || '';
  if (desuscribir.length) return;
  irA(vista);
  const alError = () => toast('No tenés permiso para ver el stock. Revisá el usuario.', { error: true });
  desuscribir.push(datos.onModelos(lista => {
    modelos = lista;
    modelosCargados = true;
    renderVista();
    refrescarCartel();
  }, alError));
  desuscribir.push(datos.onMovimientos(lista => {
    movs = lista;
    renderVista();
  }, alError));
}

addEventListener('tss-error', () => toast('No se pudo guardar. Revisá la conexión.', { error: true }));

// La altura de la cabecera fija se usa para que el encabezado de la tabla quede pegado debajo.
new ResizeObserver(([e]) => {
  document.documentElement.style.setProperty('--alto-cabecera', `${Math.round(e.target.offsetHeight)}px`);
}).observe($('.cabecera'));

// ---------------------------------------------------------------- panel y navegación

const panel = $('#panel');

function abrirPanel() {
  cerrarToast(); // el aviso tapa la parte de abajo del menú (Cerrar sesión)
  panel.classList.add('abierto');
  $('#panel-fondo').hidden = false;
  $('#btn-menu').setAttribute('aria-expanded', 'true');
}
function cerrarPanel() {
  panel.classList.remove('abierto');
  $('#panel-fondo').hidden = true;
  $('#btn-menu').setAttribute('aria-expanded', 'false');
}
$('#btn-menu').addEventListener('click', abrirPanel);
$('#panel-fondo').addEventListener('click', cerrarPanel);

document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => {
  irA(b.dataset.vista);
  cerrarPanel();
}));

// Botones con data-registrar (solo en los módulos de Ingresos y Egresos) abren el cartel.
document.addEventListener('click', e => {
  const b = e.target.closest('[data-registrar]');
  if (b) abrirRegistro(b.dataset.registrar);
});

const TITULOS = { stock: 'Stock', ingresos: 'Ingresos', egresos: 'Egresos', ventas: 'Ventas' };
const BOTON_INGRESO = '<button class="btn btn-amarillo" type="button" data-registrar="alta">+ Registrar ingreso</button>';
const BOTON_EGRESO = '<button class="btn btn-rosa" type="button" data-registrar="baja">− Registrar egreso</button>';

function irA(v) {
  vista = v;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('activo', b.dataset.vista === v));
  $('#cabecera-titulo').textContent = TITULOS[v];
  $('#vista-stock').hidden = v !== 'stock';
  $('#vista-movs').hidden = v !== 'ingresos' && v !== 'egresos';
  $('#vista-ventas').hidden = v !== 'ventas';
  $('#cabecera-acciones').innerHTML =
    v === 'stock' ? '<button class="btn btn-borde" type="button" id="btn-nuevo">+ Modelo nuevo</button>' :
    v === 'ingresos' ? BOTON_INGRESO :
    v === 'egresos' ? BOTON_EGRESO : '';
  renderVista();
  scrollTo(0, 0);
}

$('#cabecera-acciones').addEventListener('click', e => {
  if (e.target.closest('#btn-nuevo')) abrirForm(null);
});

function renderVista() {
  renderNumerosPanel();
  if (vista === 'stock') renderStock();
  else if (vista === 'ventas') renderVentas();
  else renderOps(vista === 'ingresos' ? 'alta' : 'baja');
}

// ---------------------------------------------------------------- fechas y cuentas

const formatoHora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const formatoDia = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
const formatoCorto = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });
const claveDia = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const esHoy = d => claveDia(d) === claveDia(new Date());

function nombreDia(d) {
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  if (esHoy(d)) return 'Hoy';
  if (claveDia(d) === claveDia(ayer)) return 'Ayer';
  return formatoDia.format(d);
}

function desde(p) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (p === '7') d.setDate(d.getDate() - 6);
  if (p === 'mes') d.setDate(1);
  return p === 'todo' ? new Date(0) : d;
}

const unidades = lista => lista.reduce((s, x) => s + Math.abs(x.delta), 0);
const esMovVenta = x => x.tipo === 'baja';
const importe = x => Math.abs(x.delta) * (x.precio || 0);
const invertido = x => Math.abs(x.delta) * (x.costo || 0);
// Monto de un renglón en los listados: costo en ingresos, precio en egresos.
const montoMov = x => (x.tipo === 'alta' ? invertido(x) : importe(x));

// Agrupa los movimientos de una misma operación (mismo opId), respetando el orden.
function agruparOps(lista) {
  const ops = new Map();
  for (const x of lista) {
    const clave = x.opId || x.id;
    if (!ops.has(clave)) ops.set(clave, { id: clave, tipo: x.tipo, nota: x.nota, fecha: x.fecha, lineas: [] });
    ops.get(clave).lineas.push(x);
  }
  return [...ops.values()];
}

function renderNumerosPanel() {
  $('#nav-num-stock').textContent = modelos.reduce((s, m) => s + totalModelo(m), 0);
  const deHoy = movs.filter(x => esHoy(x.fecha));
  const ing = unidades(deHoy.filter(x => x.tipo === 'alta'));
  const egr = unidades(deHoy.filter(x => x.tipo === 'baja'));
  const ven = deHoy.filter(esMovVenta).reduce((s, x) => s + importe(x), 0);
  $('#nav-num-ingresos').textContent = ing ? `+${ing} hoy` : '';
  $('#nav-num-egresos').textContent = egr ? `−${egr} hoy` : '';
  $('#nav-num-ventas').textContent = ven ? pesos(ven) : '';
}

// ---------------------------------------------------------------- módulo: stock

function renderStock() {
  const total = modelos.reduce((s, m) => s + totalModelo(m), 0);
  const agotados = modelos.filter(m => totalModelo(m) === 0).length;
  const costo = modelos.reduce((s, m) => s + totalModelo(m) * (m.costo || 0), 0);
  const valor = modelos.reduce((s, m) => s + totalModelo(m) * (m.precio || 0), 0);
  $('#kpis-stock').innerHTML = `
    <div class="kpi amarillo"><p>Unidades en stock</p><b>${total}</b></div>
    <div class="kpi ${agotados ? 'alerta' : ''}"><p>Agotados</p><b>${agotados}</b></div>
    <div class="kpi"><p>Costo del stock</p><b>${costo ? pesos(costo) : '—'}</b></div>
    <div class="kpi"><p>Valor de venta</p><b>${valor ? pesos(valor) : '—'}</b></div>`;

  const q = normalizar(busqueda);
  const visibles = modelos.filter(m => !q || normalizar(`${m.nombre} ${m.marca} ${m.color}`).includes(q));

  // Tabla (compu): una columna por talle, encabezado fijo.
  const talles = ordenarTalles([...new Set(modelos.flatMap(m => Object.keys(m.talles || {})))]);
  const filas = visibles.map(m => {
    const t = totalModelo(m);
    const celdas = talles.map(tl => {
      if (!(tl in (m.talles || {}))) return '<td><span class="n-talle no">—</span></td>';
      const n = m.talles[tl] || 0;
      return `<td><span class="n-talle ${n ? 'hay' : 'cero'}">${n}</span></td>`;
    }).join('');
    return `<tr class="${t ? '' : 'agotado'}">
      <td class="col-modelo"><div class="celda-modelo">
        <img src="${esc(fotoPrincipal(m))}" alt="" loading="lazy" width="40" height="50">
        <div><b>${esc(m.nombre)}</b><span>${esc([m.marca, m.color].filter(Boolean).join(' · '))}</span></div>
        <button class="btn-editar" type="button" data-editar="${esc(m.id)}" aria-label="Editar ${esc(m.nombre)}">${ICONO_EDITAR}</button>
      </div></td>
      ${celdas}
      <td class="col-total">${t}</td>
      <td>${m.precio ? pesos(m.precio) : '<span class="n-talle no">—</span>'}</td>
    </tr>`;
  }).join('');
  $('#tabla-stock').innerHTML = `<thead><tr>
      <th class="col-modelo" scope="col">Modelo</th>
      ${talles.map(t => `<th scope="col">${esc(t)}</th>`).join('')}
      <th scope="col">Total</th><th scope="col">Precio</th>
    </tr></thead><tbody>${filas || `<tr><td colspan="${talles.length + 3}" class="vacio">No hay modelos con ese nombre.</td></tr>`}</tbody>`;

  // Tarjetas (celular).
  $('#tarjetas-stock').innerHTML = visibles.map(m => {
    const t = totalModelo(m);
    const mini = ordenarTalles(Object.keys(m.talles || {})).map(tl => {
      const n = m.talles[tl] || 0;
      return `<span class="mini-talle ${n ? 'hay' : 'cero'}">${esc(tl)}·${n}</span>`;
    }).join('');
    return `<li class="tarjeta ${t ? '' : 'agotado'}">
      <img src="${esc(fotoPrincipal(m))}" alt="" loading="lazy" width="60" height="76">
      <div class="tarjeta-info">
        <p class="tarjeta-marca">${esc(m.marca)}${m.precio ? ` · ${pesos(m.precio)}` : ''}</p>
        <p class="tarjeta-nombre">${esc(m.nombre)}</p>
        <div class="mini-talles">${mini}</div>
      </div>
      <div class="tarjeta-lado">
        <div class="tarjeta-total">${t}<small>${t === 1 ? 'unidad' : 'unid.'}</small></div>
        <button class="btn-editar" type="button" data-editar="${esc(m.id)}" aria-label="Editar ${esc(m.nombre)}">${ICONO_EDITAR}</button>
      </div>
    </li>`;
  }).join('') || (modelos.length ? '<li class="vacio"><p>No hay modelos con ese nombre.</p></li>' : '');

  const sinNada = modelosCargados && modelos.length === 0;
  $('#vacio-modelos').hidden = !sinNada;
  $('#vista-stock .tabla-envoltura').hidden = sinNada;
}

$('#buscar').addEventListener('input', e => { busqueda = e.target.value; renderStock(); });

$('#vista-stock').addEventListener('click', e => {
  const b = e.target.closest('[data-editar]');
  if (b) abrirForm(modeloPorId(b.dataset.editar));
});

$('#btn-iniciales').addEventListener('click', async e => {
  e.target.disabled = true;
  try { await datos.cargarIniciales(modelos.map(m => m.id)); }
  catch { toast('No se pudieron cargar. Revisá la conexión.', { error: true }); }
  e.target.disabled = false;
});

// ---------------------------------------------------------------- módulos: ingresos / egresos

function renderOps(tipo) {
  const lista = movs.filter(x => x.tipo === tipo);
  const ops = agruparOps(lista);
  const color = tipo === 'alta' ? 'amarillo' : 'rosa';
  $('#kpis-movs').innerHTML = `
    <div class="kpi ${color}"><p>Unidades hoy</p><b>${unidades(lista.filter(x => esHoy(x.fecha)))}</b></div>
    <div class="kpi"><p>Últimos 7 días</p><b>${unidades(lista.filter(x => x.fecha >= desde('7')))}</b></div>
    <div class="kpi"><p>Este mes</p><b>${unidades(lista.filter(x => x.fecha >= desde('mes')))}</b></div>
    <div class="kpi"><p>${tipo === 'alta' ? 'Invertido este mes' : 'Vendido este mes'}</p><b>${pesos(lista.filter(x => x.fecha >= desde('mes')).reduce((s, x) => s + montoMov(x), 0))}</b></div>`;

  if (!ops.length) {
    $('#lista-movs').innerHTML = `<p class="vacio">Todavía no hay ${tipo === 'alta' ? 'ingresos' : 'egresos'} registrados.</p>`;
    return;
  }
  let html = '';
  let diaActual = '';
  for (const op of ops) {
    const dia = claveDia(op.fecha);
    if (dia !== diaActual) {
      if (diaActual) html += '</ul>';
      html += `<h3 class="dia">${esc(nombreDia(op.fecha))}</h3><ul class="ops">`;
      diaActual = dia;
    }
    const u = unidades(op.lineas);
    const egreso = tipo === 'baja';
    const total = op.lineas.reduce((s, x) => s + montoMov(x), 0);
    const lineas = op.lineas.map(x => {
      const n = Math.abs(x.delta);
      return `<li class="op-linea">
        <span class="op-mod">${esc(x.modelo)}</span>
        <span class="op-talle">T${esc(x.talle)}</span>
        <span class="op-cant">×${n}</span>
        <span class="op-precio">${(egreso ? x.precio : x.costo) != null ? pesos(montoMov(x)) : '—'}</span>
      </li>`;
    }).join('');
    html += `<li class="op ${esc(op.tipo)}">
      <div class="op-cab">
        <span class="op-hora">${formatoHora.format(op.fecha)}</span>
        <span class="op-total">${egreso ? '−' : '+'}${u} ${u === 1 ? 'unidad' : 'unidades'}</span>
        ${total ? `<span class="op-plata">${pesos(total)}</span>` : ''}
        ${op.nota ? `<span class="op-nota">${esc(op.nota)}</span>` : ''}
      </div>
      <ul class="op-lineas">${lineas}</ul>
    </li>`;
  }
  $('#lista-movs').innerHTML = html + '</ul>';
}

// ---------------------------------------------------------------- módulo: ventas (se nutre de los egresos)

function renderVentas() {
  const ventas = movs.filter(x => esMovVenta(x) && x.fecha >= desde(periodo));
  const facturado = ventas.reduce((s, x) => s + importe(x), 0);
  const u = unidades(ventas);
  const operaciones = agruparOps(ventas).length;
  $('#kpis-ventas').innerHTML = `
    <div class="kpi amarillo"><p>Facturado</p><b>${pesos(facturado)}</b></div>
    <div class="kpi rosa"><p>Unidades vendidas</p><b>${u}</b></div>
    <div class="kpi"><p>Ventas</p><b>${operaciones}</b></div>
    <div class="kpi"><p>Ticket promedio</p><b>${operaciones ? pesos(facturado / operaciones) : '—'}</b></div>`;

  const porModelo = new Map();
  for (const x of ventas) {
    if (!porModelo.has(x.modeloId)) porModelo.set(x.modeloId, { id: x.modeloId, nombre: x.modelo, unidades: 0, importe: 0, talles: {}, ultima: x.fecha });
    const r = porModelo.get(x.modeloId);
    const n = Math.abs(x.delta);
    r.unidades += n;
    r.importe += importe(x);
    r.talles[x.talle] = (r.talles[x.talle] || 0) + n;
    if (x.fecha > r.ultima) r.ultima = x.fecha;
  }
  const filas = [...porModelo.values()].sort((a, b) => b.importe - a.importe || b.unidades - a.unidades);
  const max = Math.max(1, ...filas.map(r => r.importe));

  if (!filas.length) {
    $('#tabla-ventas').innerHTML = '';
    $('.tabla-ventas-env').hidden = true;
    $('#tarjetas-ventas').innerHTML = '<li class="vacio"><p>No hay ventas en este período. Las ventas se cargan desde <b>Egresos</b>.</p></li>';
    $('#tarjetas-ventas').style.display = 'grid';
    return;
  }
  $('.tabla-ventas-env').hidden = false;
  $('#tarjetas-ventas').style.display = '';

  const tallesTxt = r => ordenarTalles(Object.keys(r.talles))
    .map(t => `<span class="mini-talle hay">${esc(t)}·${r.talles[t]}</span>`).join('');
  const foto = r => esc(modeloPorId(r.id) ? fotoPrincipal(modeloPorId(r.id)) : 'img/logo.webp');

  $('#tabla-ventas').innerHTML = `<thead><tr>
      <th class="col-modelo" scope="col">Modelo</th><th scope="col">Unidades</th><th scope="col">Talles vendidos</th>
      <th scope="col">Precio prom.</th><th scope="col">Facturado</th><th scope="col">Última venta</th>
    </tr></thead><tbody>${filas.map(r => `<tr>
      <td class="col-modelo"><div class="celda-modelo">
        <img src="${foto(r)}" alt="" loading="lazy" width="40" height="50">
        <div><b>${esc(r.nombre)}</b><div class="barra-venta"><i style="width:${(r.importe / max) * 100}%"></i></div></div>
      </div></td>
      <td class="col-total">${r.unidades}</td>
      <td><div class="talles-vendidos">${tallesTxt(r)}</div></td>
      <td>${pesos(r.importe / r.unidades)}</td>
      <td class="col-plata">${pesos(r.importe)}</td>
      <td>${esHoy(r.ultima) ? 'Hoy' : formatoCorto.format(r.ultima)}</td>
    </tr>`).join('')}</tbody>`;

  $('#tarjetas-ventas').innerHTML = filas.map(r => `<li class="tarjeta">
      <img src="${foto(r)}" alt="" loading="lazy" width="60" height="76">
      <div class="tarjeta-info">
        <p class="tarjeta-marca">${r.unidades} ${r.unidades === 1 ? 'unidad' : 'unidades'} · prom. ${pesos(r.importe / r.unidades)}</p>
        <p class="tarjeta-nombre">${esc(r.nombre)}</p>
        <div class="mini-talles">${tallesTxt(r)}</div>
        <div class="barra-venta"><i style="width:${(r.importe / max) * 100}%"></i></div>
      </div>
      <div class="tarjeta-lado"><div class="tarjeta-total" style="font-size:17px">${pesos(r.importe)}</div></div>
    </li>`).join('');
}

document.querySelector('.periodos').addEventListener('click', e => {
  const b = e.target.closest('.chip');
  if (!b) return;
  periodo = b.dataset.periodo;
  document.querySelectorAll('.periodos .chip').forEach(x => {
    x.classList.toggle('activo', x === b);
    x.setAttribute('aria-selected', x === b);
  });
  renderVentas();
});

// ---------------------------------------------------------------- cartel: registrar ingreso / egreso
// Un registro tiene uno o varios modelos (renglones), con cantidades por talle.
// Cada talle lleva su monto por unidad: costo en un ingreso, precio en un egreso (venta).

const cartel = $('#cartel');
let reg = null;

const esEgreso = () => reg?.tipo === 'baja';
const soloDigitos = v => String(v ?? '').replace(/\D/g, '');
// type="text" + inputmode="numeric" abre el teclado de números en el celular (iPhone y Android).
const NUMERICO = 'type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off"';

function abrirRegistro(tipo, modeloId = null) {
  reg = { tipo, items: [], buscando: true };
  cartel.classList.toggle('alta', tipo === 'alta');
  cartel.classList.toggle('baja', tipo === 'baja');
  $('#cartel-titulo').textContent = tipo === 'alta' ? 'Registrar ingreso' : 'Registrar egreso';
  $('#reg-buscar').value = '';
  $('#reg-nota').value = '';
  $('#reg-nota').placeholder = tipo === 'alta' ? 'Proveedor, observaciones, etc.' : 'Cliente, envío, forma de pago, etc.';
  document.querySelectorAll('[data-nuevo-modelo]').forEach(b => { b.hidden = tipo !== 'alta'; });
  if (modeloId) agregarItem(modeloId); else renderCartel();
  cartel.showModal();
  cartel.querySelector('.cartel-cuerpo').scrollTop = 0;
  if (!modeloId && esCompu()) $('#reg-buscar').focus();
}

function agregarItem(id) {
  if (!reg.items.some(it => it.modeloId === id)) reg.items.push({ modeloId: id, cant: {}, precios: {}, extras: [] });
  reg.buscando = false;
  renderCartel();
}

function renderCartel() {
  if (!reg) return;
  renderItems();
  $('#reg-selector').hidden = !reg.buscando;
  $('#reg-agregar-fila').hidden = reg.buscando || !reg.items.length;
  if (reg.buscando) renderOpcionesModelo();
  actualizarResumen();
}

// Si cambia el stock con el cartel abierto se redibuja, salvo que se esté escribiendo en un campo.
function refrescarCartel() {
  if (!cartel.open || !reg) return;
  const activo = document.activeElement;
  if (activo && cartel.contains(activo) && activo.tagName === 'INPUT') { actualizarResumen(); return; }
  renderCartel();
}

// Se sugiere el último costo (ingreso) o el precio de venta (egreso) del modelo.
const montoSugerido = m => String((esEgreso() ? m?.precio : m?.costo) || '');
const palabraMonto = () => (esEgreso() ? 'precio' : 'costo');

function stepper(t, n, sinStock, tope) {
  return `<span class="it-stepper">
    <button type="button" data-paso="-1" aria-label="Uno menos del talle ${esc(t)}" ${n <= 0 ? 'disabled' : ''}>−</button>
    <input ${NUMERICO} data-cant value="${n || ''}" placeholder="0" aria-label="Cantidad del talle ${esc(t)}" ${sinStock ? 'disabled' : ''}>
    <button type="button" data-paso="1" aria-label="Uno más del talle ${esc(t)}" ${sinStock || tope ? 'disabled' : ''}>+</button>
  </span>`;
}

function renderItems() {
  const egreso = esEgreso();
  const Monto = egreso ? 'Precio' : 'Costo';
  $('#reg-items').innerHTML = reg.items.map((it, idx) => {
    const m = modeloPorId(it.modeloId);
    if (!m) return '';
    // Egreso: solo los talles con stock. Ingreso: todos, más los que se agreguen.
    const talles = egreso
      ? ordenarTalles(Object.keys(m.talles || {})).filter(t => (m.talles[t] || 0) > 0)
      : ordenarTalles([...new Set([...Object.keys(m.talles || {}), ...it.extras])]);
    const filas = talles.map(t => {
      const hay = m.talles?.[t] || 0;
      const n = it.cant[t] || 0;
      const nuevo = !(t in (m.talles || {}));
      return `<div class="it-talle eg-fila ${n ? 'con' : ''}" data-talle="${esc(t)}">
        <span class="it-t"><b>${esc(t)}</b><small>${nuevo ? 'nuevo' : `hay ${hay}`}</small></span>
        ${stepper(t, n, false, egreso && n >= hay)}
        <span class="moneda"><input ${NUMERICO} data-precio value="${esc(it.precios[t] ?? '')}" placeholder="${Monto}"
          aria-label="${Monto} por unidad del talle ${esc(t)}"></span>
        <span class="eg-sub" data-sub></span>
      </div>`;
    }).join('');
    const otro = egreso ? '' : `
      <div class="item-otro">
        <input type="text" maxlength="6" placeholder="Otro talle (ej: 40)" data-otro-input aria-label="Agregar otro talle a ${esc(m.nombre)}">
        <button type="button" class="btn btn-borde" data-otro>+ Talle</button>
      </div>`;
    return `<div class="item" data-idx="${idx}">
      <div class="item-cab">
        <img src="${esc(fotoPrincipal(m))}" alt="" width="34" height="42">
        <span><b>${esc(m.nombre)}</b><small>${esc(m.marca || '')} · ${totalModelo(m)} en stock</small></span>
        <button type="button" class="btn-icono" data-quitar aria-label="Quitar ${esc(m.nombre)}">${ICONO_CERRAR}</button>
      </div>
      <div class="eg-filas">${filas || '<p class="vacio">Este modelo no tiene stock.</p>'}</div>
      ${otro}
      <div class="item-total" data-subtotal></div>
    </div>`;
  }).join('');
  reg.items.forEach((it, idx) => actualizarSubtotal(idx));
}

function renderOpcionesModelo() {
  const q = normalizar($('#reg-buscar').value);
  const ya = new Set(reg.items.map(it => it.modeloId));
  const lista = modelos.filter(m => !ya.has(m.id) && (!q || normalizar(`${m.nombre} ${m.marca} ${m.color}`).includes(q)));
  $('#reg-opciones').innerHTML = lista.map(m => {
    const t = totalModelo(m);
    const sinStock = esEgreso() && t === 0;
    return `<li><button type="button" class="opcion-modelo" data-id="${esc(m.id)}" ${sinStock ? 'disabled' : ''}>
      <img src="${esc(fotoPrincipal(m))}" alt="" loading="lazy" width="40" height="50">
      <span><b>${esc(m.nombre)}</b><small>${esc([m.marca, m.color].filter(Boolean).join(' · '))}</small></span>
      <span class="opcion-total">${sinStock ? 'sin stock' : `${t} en stock`}</span>
    </button></li>`;
  }).join('') || '<li class="vacio">No hay modelos con ese nombre.</li>';
}

function actualizarCelda(celda, it, m) {
  const t = celda.dataset.talle;
  const n = it.cant[t] || 0;
  const hay = m.talles?.[t] || 0;
  celda.classList.toggle('con', n > 0);
  celda.querySelector('[data-paso="-1"]').disabled = n <= 0;
  celda.querySelector('[data-paso="1"]').disabled = esEgreso() && n >= hay;
  // Al cargar un talle por primera vez se sugiere el costo o el precio del modelo.
  const monto = celda.querySelector('[data-precio]');
  if (monto && n > 0 && (it.precios[t] ?? '') === '' && montoSugerido(m)) {
    it.precios[t] = montoSugerido(m);
    monto.value = it.precios[t];
  }
}

function actualizarSubtotal(idx) {
  const itemEl = document.querySelector(`.item[data-idx="${idx}"]`);
  if (!itemEl) return;
  const it = reg.items[idx];
  let total = 0;
  itemEl.querySelectorAll('.eg-fila').forEach(fila => {
    const t = fila.dataset.talle;
    const n = it.cant[t] || 0;
    const p = it.precios[t];
    const sub = n && p ? n * entero(p) : 0;
    total += sub;
    fila.querySelector('[data-sub]').textContent = n && p ? pesos(sub) : '';
    fila.querySelector('[data-precio]').classList.toggle('falta', n > 0 && (p ?? '') === '');
  });
  itemEl.querySelector('[data-subtotal]').textContent = total ? `Subtotal ${pesos(total)}` : '';
}

// Junta los renglones con cantidad y valida. Devuelve { lineas, unidades, total, error }.
function armarRegistro() {
  const lineas = [];
  let error = '';
  for (const it of reg.items) {
    const m = modeloPorId(it.modeloId);
    if (!m) continue;
    for (const [t, n] of Object.entries(it.cant)) {
      if (!n) continue;
      const hay = m.talles?.[t] || 0;
      if (esEgreso() && n > hay) error ||= `${m.nombre} talle ${t}: hay ${hay}, no alcanza para ${n}.`;
      if ((it.precios[t] ?? '') === '') error ||= `Falta el ${palabraMonto()} de ${m.nombre} talle ${t}.`;
      const monto = entero(it.precios[t]);
      lineas.push(esEgreso()
        ? { modelo: m, talle: t, delta: -n, precio: monto }
        : { modelo: m, talle: t, delta: n, costo: monto });
    }
  }
  const u = lineas.reduce((s, l) => s + Math.abs(l.delta), 0);
  const total = lineas.reduce((s, l) => s + Math.abs(l.delta) * ((esEgreso() ? l.precio : l.costo) || 0), 0);
  return { lineas, unidades: u, total, error };
}

function actualizarResumen() {
  const r = $('#reg-resumen');
  const ok = $('#reg-ok');
  const { lineas, unidades: u, total, error } = armarRegistro();
  r.classList.toggle('error', !!error);
  ok.disabled = true;
  ok.textContent = esEgreso() ? 'Registrar egreso' : 'Registrar ingreso';

  if (!reg.items.length) { r.textContent = 'Elegí un modelo.'; return; }
  if (!u) { r.textContent = 'Poné la cantidad en al menos un talle.'; return; }
  if (error) { r.textContent = error; return; }

  const modelosN = new Set(lineas.map(l => l.modelo.id)).size;
  r.innerHTML = `<b>${u}</b> ${u === 1 ? 'unidad' : 'unidades'} en <b>${modelosN}</b> ${modelosN === 1 ? 'modelo' : 'modelos'}`
    + (esEgreso() ? ` · Total <b>${pesos(total)}</b>` : ` · Costo total <b>${pesos(total)}</b>`);
  ok.textContent += esEgreso() ? ` (${pesos(total)})` : ` (+${u} · ${pesos(total)})`;
  ok.disabled = false;
}

$('#reg-buscar').addEventListener('input', renderOpcionesModelo);
$('#reg-buscar').addEventListener('keydown', e => {
  // Enter con un solo resultado lo elige.
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const opciones = [...document.querySelectorAll('.opcion-modelo:not(:disabled)')];
  if (opciones.length === 1) agregarItem(opciones[0].dataset.id);
});

$('#reg-agregar').addEventListener('click', () => {
  reg.buscando = true;
  $('#reg-buscar').value = '';
  renderCartel();
  if (esCompu()) $('#reg-buscar').focus();
  $('#reg-selector').scrollIntoView({ block: 'nearest' });
});

cartel.addEventListener('click', e => {
  if (e.target.closest('[data-nuevo-modelo]')) abrirForm(null);
});

$('#reg-opciones').addEventListener('click', e => {
  const b = e.target.closest('.opcion-modelo');
  if (b && !b.disabled) agregarItem(b.dataset.id);
});

function agregarTalleOtro(itemEl) {
  const it = reg.items[itemEl.dataset.idx];
  const inp = itemEl.querySelector('[data-otro-input]');
  const t = inp.value.trim().toUpperCase().replace(/[.\s/]/g, '');
  if (!t) return;
  if (!it.extras.includes(t)) it.extras.push(t);
  it.cant[t] = it.cant[t] || 1;
  renderCartel();
}

$('#reg-items').addEventListener('click', e => {
  const itemEl = e.target.closest('.item');
  if (!itemEl) return;
  const idx = Number(itemEl.dataset.idx);
  const it = reg.items[idx];
  const m = modeloPorId(it.modeloId);

  if (e.target.closest('[data-quitar]')) {
    reg.items.splice(idx, 1);
    if (!reg.items.length) reg.buscando = true;
    renderCartel();
    return;
  }
  if (e.target.closest('[data-otro]')) { agregarTalleOtro(itemEl); return; }

  const paso = e.target.closest('[data-paso]');
  if (paso && !paso.disabled) {
    const celda = paso.closest('.it-talle');
    const t = celda.dataset.talle;
    const hay = m.talles?.[t] || 0;
    let n = (it.cant[t] || 0) + Number(paso.dataset.paso);
    n = Math.max(0, esEgreso() ? Math.min(n, hay) : n);
    it.cant[t] = n;
    celda.querySelector('[data-cant]').value = n || '';
    vibrar();
    actualizarCelda(celda, it, m);
    actualizarSubtotal(idx);
    actualizarResumen();
  }
});

$('#reg-items').addEventListener('input', e => {
  const itemEl = e.target.closest('.item');
  if (!itemEl || e.target.matches('[data-otro-input]')) return;
  const idx = Number(itemEl.dataset.idx);
  const it = reg.items[idx];
  const m = modeloPorId(it.modeloId);
  const celda = e.target.closest('.it-talle');
  const t = celda.dataset.talle;

  if (e.target.matches('[data-cant]')) {
    const hay = m.talles?.[t] || 0;
    let n = entero(soloDigitos(e.target.value));
    if (esEgreso() && n > hay) n = hay;
    e.target.value = n || '';
    it.cant[t] = n;
    actualizarCelda(celda, it, m);
  } else if (e.target.matches('[data-precio]')) {
    e.target.value = soloDigitos(e.target.value);
    it.precios[t] = e.target.value;
  }
  actualizarSubtotal(idx);
  actualizarResumen();
});

$('#reg-items').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('[data-otro-input]')) {
    e.preventDefault();
    agregarTalleOtro(e.target.closest('.item'));
  }
});

$('#reg-items').addEventListener('focusin', e => {
  if (e.target.matches('[data-cant], [data-precio]')) e.target.select();
});

$('#form-registro').addEventListener('submit', async e => {
  e.preventDefault();
  const { lineas, unidades: u, total, error } = armarRegistro();
  if (!u || error) return;
  const tipo = reg.tipo;
  const nota = $('#reg-nota').value.trim();
  cartel.close();
  vibrar();
  const ids = await datos.registrar({ tipo, nota, lineas });
  const unid = `${u} ${u === 1 ? 'unidad' : 'unidades'}`;
  toast(tipo === 'alta' ? `Ingreso registrado: +${unid} · ${pesos(total)}` : `Egreso registrado: ${unid} · ${pesos(total)}`, { deshacer: ids });
  // El último costo cargado queda guardado en el modelo para sugerirlo la próxima vez.
  if (tipo === 'alta') {
    const ultimo = new Map(lineas.map(l => [l.modelo.id, l.costo]));
    ultimo.forEach((costo, id) => {
      if (modeloPorId(id)?.costo !== costo) datos.guardarModelo(id, { costo }).catch(() => {});
    });
  }
});

cartel.addEventListener('close', () => { reg = null; });

// ---------------------------------------------------------------- crear / editar modelo

const hojaForm = $('#hoja-form');
const formModelo = $('#form-modelo');
let formCtx = null;

function abrirForm(m) {
  formCtx = { m, fotoData: m?.fotoData || null, talles: new Set(m ? Object.keys(m.talles || {}) : TALLES_BASE) };
  $('#hf-titulo').textContent = m ? 'Editar modelo' : 'Modelo nuevo';
  formModelo.nombre.value = m?.nombre || '';
  formModelo.marca.value = m?.marca || '';
  formModelo.color.value = m?.color || '';
  formModelo.costo.value = m?.costo ?? '';
  formModelo.precio.value = m?.precio ?? '';
  $('#hf-borrar').hidden = !m;
  $('#hf-error').textContent = '';
  $('#hf-talle-otro').value = '';
  pintarFoto(m ? fotoPrincipal(m) : null);
  pintarTallesForm();
  hojaForm.showModal();
}

function pintarFoto(src) {
  $('#hf-foto-img').hidden = !src;
  if (src) $('#hf-foto-img').src = src;
  $('#hf-foto-texto').hidden = !!src;
}

function pintarTallesForm() {
  const m = formCtx.m;
  const todos = ordenarTalles([...new Set([...TALLES_OPCIONES, ...formCtx.talles])]);
  $('#hf-talles').innerHTML = todos.map(t => {
    const n = m?.talles?.[t] || 0;
    return `<label><input type="checkbox" value="${esc(t)}" ${formCtx.talles.has(t) ? 'checked' : ''}>
      <span>${esc(t)}${n ? `<small>(${n})</small>` : ''}</span></label>`;
  }).join('');
}

$('#hf-talles').addEventListener('change', e => {
  if (e.target.checked) formCtx.talles.add(e.target.value);
  else formCtx.talles.delete(e.target.value);
});

$('#hf-talle-agregar').addEventListener('click', () => {
  const t = $('#hf-talle-otro').value.trim().toUpperCase().replace(/[.\s/]/g, '');
  if (!t) return;
  formCtx.talles.add(t);
  $('#hf-talle-otro').value = '';
  pintarTallesForm();
});

$('#hf-foto').addEventListener('change', async e => {
  const archivo = e.target.files?.[0];
  if (!archivo) return;
  try {
    formCtx.fotoData = await achicarFoto(archivo);
    pintarFoto(formCtx.fotoData);
  } catch {
    $('#hf-error').textContent = 'No se pudo leer la foto. Probá con otra.';
  }
  e.target.value = '';
});

// La foto se guarda achicada adentro del modelo (unos 60 KB), así no hace falta Firebase Storage.
function achicarFoto(archivo, lado = 720) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(); };
    img.src = url;
  });
}

formModelo.addEventListener('submit', async e => {
  e.preventDefault();
  const m = formCtx.m;
  const nombre = formModelo.nombre.value.trim();
  if (!nombre) { $('#hf-error').textContent = 'Poné un nombre.'; return; }
  if (!formCtx.talles.size) { $('#hf-error').textContent = 'Elegí al menos un talle.'; return; }

  const sacados = Object.entries(m?.talles || {}).filter(([t, n]) => n > 0 && !formCtx.talles.has(t));
  if (sacados.length && !confirm(`Estás sacando talles que tienen stock (${sacados.map(([t, n]) => `${t}: ${n}`).join(', ')}). ¿Seguir?`)) return;

  const aMonto = v => (soloDigitos(v) === '' ? null : entero(soloDigitos(v)));
  const precio = aMonto(formModelo.precio.value);
  const costo = aMonto(formModelo.costo.value);
  const talles = Object.fromEntries([...formCtx.talles].map(t => [t, m?.talles?.[t] || 0]));
  const datosModelo = {
    nombre,
    marca: formModelo.marca.value.trim(),
    color: formModelo.color.value.trim(),
    costo,
    precio,
    talles,
    fotoData: formCtx.fotoData || null,
  };
  if (!m) {
    datosModelo.fotos = [];
    datosModelo.orden = modelos.reduce((max, x) => Math.max(max, x.orden ?? 0), -1) + 1;
  }

  const boton = formModelo.querySelector('[type=submit]');
  boton.disabled = true;
  try {
    const id = await datos.guardarModelo(m?.id, datosModelo);
    hojaForm.close();
    if (m) {
      toast('Modelo actualizado.');
    } else if (cartel.open && reg?.tipo === 'alta') {
      // Creado desde el cartel de ingreso: se suma como renglón.
      agregarItem(id);
      toast('Modelo creado. Cargá las cantidades.');
    } else {
      // Creado desde Stock: se abre el ingreso para cargarle mercadería.
      irA('ingresos');
      abrirRegistro('alta', id);
      toast('Modelo creado. Cargá las cantidades.');
    }
  } catch {
    $('#hf-error').textContent = 'No se pudo guardar. Revisá la conexión.';
  } finally {
    boton.disabled = false;
  }
});

$('#hf-borrar').addEventListener('click', async () => {
  const m = formCtx.m;
  const total = totalModelo(m);
  const aviso = total ? ` Tiene ${total} unidades cargadas.` : '';
  if (!confirm(`¿Borrar "${m.nombre}"?${aviso} No se puede deshacer.`)) return;
  try {
    await datos.borrarModelo(m.id);
    hojaForm.close();
    toast('Modelo borrado.');
  } catch {
    $('#hf-error').textContent = 'No se pudo borrar. Revisá la conexión.';
  }
});

// ---------------------------------------------------------------- carteles y avisos

document.querySelectorAll('dialog').forEach(d => {
  // Cierra al tocar afuera (el fondo oscuro) o una X; tocar el borde del cartel no lo cierra.
  d.addEventListener('click', e => {
    const r = d.getBoundingClientRect();
    const afuera = e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right;
    if ((e.target === d && afuera) || e.target.closest('[data-cerrar]')) d.close();
  });
});

const elToast = $('#toast');
let timerToast = null;
let paraDeshacer = null;
if (!elToast.showPopover) elToast.hidden = true;

function toast(texto, { error = false, deshacer = null } = {}) {
  $('#toast-texto').textContent = texto;
  elToast.classList.toggle('error', error);
  paraDeshacer = deshacer;
  $('#toast-deshacer').hidden = !deshacer;
  if (error) navigator.vibrate?.([30, 40, 30]);
  // Un cartel abierto bloquea todo lo de afuera: el aviso se mete adentro para que "Deshacer" funcione.
  const abierto = [...document.querySelectorAll('dialog[open]')].pop() || document.body;
  if (elToast.parentElement !== abierto) abierto.append(elToast);
  if (elToast.showPopover) {
    // Se vuelve a abrir para que quede arriba de cualquier cartel.
    if (elToast.matches(':popover-open')) elToast.hidePopover();
    elToast.showPopover();
  } else {
    elToast.hidden = false;
  }
  clearTimeout(timerToast);
  timerToast = setTimeout(cerrarToast, deshacer ? 7000 : 3000);
}

function cerrarToast() {
  if (elToast.hidePopover && elToast.matches(':popover-open')) elToast.hidePopover();
  else elToast.hidden = true;
}

$('#toast-deshacer').addEventListener('click', async () => {
  const ids = paraDeshacer;
  if (!ids) return;
  paraDeshacer = null;
  cerrarToast();
  vibrar();
  await datos.deshacer(ids);
  toast('Listo, se deshizo.');
});
})();
