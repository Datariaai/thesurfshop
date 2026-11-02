(async function () {
const { MODO_PRUEBA, ordenarTalles, totalModelo, fotoPrincipal, TALLES_BASE } = window.TSS;
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

const POCO_STOCK = 2;
const TALLES_OPCIONES = ['26', '28', '30', '32', '34', '36', '38', '40', 'S', 'M', 'L', 'XL'];
const MOTIVOS = {
  alta: ['Compra', 'Devolución', 'Otro'],
  baja: ['Venta', 'Falla / daño', 'Otro'],
};
const ICONO_EDITAR = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg>';

let modelos = [];
let movs = [];
let modelosCargados = false;
let vista = 'stock';
let filtro = 'todos';
let busqueda = '';
let filtroMovModelo = null;
let desuscribir = [];

// ---------------------------------------------------------------- ingreso

datos.onUsuario(u => (u ? iniciarApp(u) : mostrarLogin()));

function mostrarLogin() {
  desuscribir.forEach(f => f());
  desuscribir = [];
  $('#app').hidden = true;
  $('#login').hidden = false;
  if (MODO_PRUEBA) {
    $('#form-login').hidden = true;
    $('#btn-entrar-prueba').hidden = false;
    $('#login-nota').textContent = 'Modo prueba: todavía no está conectado Firebase.';
  }
}

$('#btn-entrar-prueba').addEventListener('click', () => datos.entrar());

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
  $('#aviso-prueba').hidden = !MODO_PRUEBA;
  $('#panel-usuario').textContent = usuario.email || '';
  if (desuscribir.length) return;
  irA(vista);
  const alError = () => toast('No tenés permiso para ver el stock. Revisá el usuario.', { error: true });
  desuscribir.push(datos.onModelos(lista => {
    modelos = lista;
    modelosCargados = true;
    renderVista();
    if (cartel.open) renderCartel();
  }, alError));
  desuscribir.push(datos.onMovimientos(lista => {
    movs = lista;
    renderVista();
  }, alError));
}

addEventListener('tss-error', () => toast('No se pudo guardar. Revisá la conexión.', { error: true }));

// ---------------------------------------------------------------- panel y navegación

const panel = $('#panel');

function abrirPanel() {
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
  filtroMovModelo = null;
  irA(b.dataset.vista);
  cerrarPanel();
}));

// Cualquier botón con data-registrar abre el cartel (panel, cabecera, páginas de altas/bajas).
document.addEventListener('click', e => {
  const b = e.target.closest('[data-registrar]');
  if (!b) return;
  cerrarPanel();
  abrirRegistro(b.dataset.registrar, b.dataset.id || null);
});

const TITULOS = { stock: 'Stock', altas: 'Altas', bajas: 'Bajas' };

function irA(v) {
  vista = v;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('activo', b.dataset.vista === v));
  $('#cabecera-titulo').textContent = TITULOS[v];
  $('#vista-stock').hidden = v !== 'stock';
  $('#vista-movs').hidden = v === 'stock';
  $('#cabecera-acciones').innerHTML =
    v === 'stock' ? '<button class="btn btn-borde" type="button" id="btn-nuevo">+ Nuevo modelo</button>' :
    v === 'altas' ? '<button class="btn btn-amarillo" type="button" data-registrar="alta">+ Alta</button>' :
    '<button class="btn btn-rosa" type="button" data-registrar="baja">− Baja</button>';
  renderVista();
  scrollTo(0, 0);
}

$('#cabecera-acciones').addEventListener('click', e => {
  if (e.target.closest('#btn-nuevo')) abrirForm(null);
});

function renderVista() {
  renderNumerosPanel();
  if (vista === 'stock') renderStock();
  else renderMovs(vista === 'altas' ? 'alta' : 'baja');
}

// ---------------------------------------------------------------- fechas

const formatoHora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const formatoDia = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
const claveDia = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const esHoy = d => claveDia(d) === claveDia(new Date());

function nombreDia(d) {
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  if (esHoy(d)) return 'Hoy';
  if (claveDia(d) === claveDia(ayer)) return 'Ayer';
  return formatoDia.format(d);
}

const unidades = lista => lista.reduce((s, x) => s + Math.abs(x.delta), 0);

function renderNumerosPanel() {
  $('#nav-num-stock').textContent = modelos.reduce((s, m) => s + totalModelo(m), 0);
  const deHoy = movs.filter(x => esHoy(x.fecha));
  const altasHoy = unidades(deHoy.filter(x => x.tipo === 'alta'));
  const bajasHoy = unidades(deHoy.filter(x => x.tipo === 'baja'));
  $('#nav-num-altas').textContent = altasHoy ? `+${altasHoy} hoy` : '';
  $('#nav-num-bajas').textContent = bajasHoy ? `−${bajasHoy} hoy` : '';
}

// ---------------------------------------------------------------- vista stock

const pasaFiltro = (m, f = filtro) => {
  const t = totalModelo(m);
  return f === 'con' ? t > 0 : f === 'sin' ? t === 0 : f === 'bajo' ? t > 0 && t <= POCO_STOCK : true;
};

function renderStock() {
  const total = modelos.reduce((s, m) => s + totalModelo(m), 0);
  const agotados = modelos.filter(m => totalModelo(m) === 0).length;
  const poco = modelos.filter(m => pasaFiltro(m, 'bajo')).length;
  $('#kpis-stock').innerHTML = `
    <div class="kpi amarillo"><p>Unidades en stock</p><b>${total}</b></div>
    <div class="kpi"><p>Modelos</p><b>${modelos.length}</b></div>
    <div class="kpi"><p>Poco stock</p><b>${poco}</b></div>
    <div class="kpi ${agotados ? 'alerta' : ''}"><p>Agotados</p><b>${agotados}</b></div>`;

  const q = normalizar(busqueda);
  const buscados = modelos.filter(m => !q || normalizar(`${m.nombre} ${m.marca} ${m.color}`).includes(q));
  const visibles = buscados.filter(m => pasaFiltro(m));

  document.querySelectorAll('.filtros .chip').forEach(b => {
    b.innerHTML = `${esc(b.dataset.nombre)} <span class="n">${buscados.filter(m => pasaFiltro(m, b.dataset.filtro)).length}</span>`;
  });

  // Tabla (compu): una columna por talle.
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
      <td class="col-acciones"><div class="acciones-fila">
        <button class="btn-mini alta" type="button" data-registrar="alta" data-id="${esc(m.id)}">+ Alta</button>
        <button class="btn-mini baja" type="button" data-registrar="baja" data-id="${esc(m.id)}" ${t ? '' : 'disabled'}>− Baja</button>
      </div></td>
    </tr>`;
  }).join('');
  $('#tabla-stock').innerHTML = `<thead><tr>
      <th class="col-modelo" scope="col">Modelo</th>
      ${talles.map(t => `<th scope="col">${esc(t)}</th>`).join('')}
      <th scope="col">Total</th><th scope="col"><span class="sr-only">Acciones</span></th>
    </tr></thead><tbody>${filas}</tbody>`;

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
        <p class="tarjeta-marca">${esc(m.marca)}</p>
        <p class="tarjeta-nombre">${esc(m.nombre)}</p>
        <div class="mini-talles">${mini}</div>
      </div>
      <div class="tarjeta-total">${t}<small>${t === 1 ? 'unidad' : 'unid.'}</small></div>
      <div class="tarjeta-acciones">
        <button class="btn-mini alta" type="button" data-registrar="alta" data-id="${esc(m.id)}">+ Alta</button>
        <button class="btn-mini baja" type="button" data-registrar="baja" data-id="${esc(m.id)}" ${t ? '' : 'disabled'}>− Baja</button>
        <button class="btn-editar" type="button" data-editar="${esc(m.id)}" aria-label="Editar ${esc(m.nombre)}">${ICONO_EDITAR}</button>
      </div>
    </li>`;
  }).join('');

  const sinNada = modelosCargados && modelos.length === 0;
  $('#vacio-modelos').hidden = !sinNada;
  $('.tabla-envoltura').hidden = sinNada;
  if (!sinNada && modelosCargados && !visibles.length) {
    $('#tarjetas-stock').innerHTML = '<li class="vacio"><p>No hay modelos con ese filtro.</p></li>';
    $('#tabla-stock tbody').innerHTML = `<tr><td colspan="${talles.length + 3}" class="vacio">No hay modelos con ese filtro.</td></tr>`;
  }
}

$('#buscar').addEventListener('input', e => { busqueda = e.target.value; renderStock(); });

document.querySelector('.filtros').addEventListener('click', e => {
  const b = e.target.closest('.chip');
  if (!b) return;
  filtro = b.dataset.filtro;
  document.querySelectorAll('.filtros .chip').forEach(x => {
    x.classList.toggle('activo', x === b);
    x.setAttribute('aria-selected', x === b);
  });
  renderStock();
});

$('#vista-stock').addEventListener('click', e => {
  const b = e.target.closest('[data-editar]');
  if (b) abrirForm(modelos.find(m => m.id === b.dataset.editar));
});

$('#btn-iniciales').addEventListener('click', async e => {
  e.target.disabled = true;
  try { await datos.cargarIniciales(modelos.map(m => m.id)); }
  catch { toast('No se pudieron cargar. Revisá la conexión.', { error: true }); }
  e.target.disabled = false;
});

// ---------------------------------------------------------------- vistas altas / bajas

function renderMovs(tipo) {
  const delTipo = movs.filter(x => x.tipo === tipo);
  const lista = filtroMovModelo ? delTipo.filter(x => x.modeloId === filtroMovModelo) : delTipo;

  const hace7 = new Date(); hace7.setHours(0, 0, 0, 0); hace7.setDate(hace7.getDate() - 6);
  const ahora = new Date();
  const delMes = lista.filter(x => x.fecha.getMonth() === ahora.getMonth() && x.fecha.getFullYear() === ahora.getFullYear());
  const color = tipo === 'alta' ? 'amarillo' : 'rosa';
  const palabra = tipo === 'alta' ? 'Entraron' : 'Salieron';
  $('#kpis-movs').innerHTML = `
    <div class="kpi ${color}"><p>${palabra} hoy</p><b>${unidades(lista.filter(x => esHoy(x.fecha)))}</b></div>
    <div class="kpi"><p>Últimos 7 días</p><b>${unidades(lista.filter(x => x.fecha >= hace7))}</b></div>
    <div class="kpi"><p>Este mes</p><b>${unidades(delMes)}</b></div>
    <div class="kpi"><p>Registros</p><b>${lista.length}</b></div>`;

  $('#registrar-grande').innerHTML = tipo === 'alta'
    ? '<button class="btn btn-amarillo" type="button" data-registrar="alta">+ Registrar alta</button>'
    : '<button class="btn btn-rosa" type="button" data-registrar="baja">− Registrar baja</button>';

  const fm = $('#filtro-modelo');
  fm.hidden = !filtroMovModelo;
  if (filtroMovModelo) {
    const m = modelos.find(x => x.id === filtroMovModelo);
    fm.innerHTML = `<button class="chip" type="button" id="quitar-filtro" aria-label="Ver todos los modelos">${esc(m?.nombre || 'Modelo')} ✕</button>`;
  }

  if (!lista.length) {
    $('#lista-movs').innerHTML = `<p class="vacio">Todavía no hay ${tipo === 'alta' ? 'altas' : 'bajas'} registradas.</p>`;
    return;
  }
  let html = '';
  let diaActual = '';
  for (const x of lista) {
    const dia = claveDia(x.fecha);
    if (dia !== diaActual) {
      if (diaActual) html += '</ul>';
      html += `<h3 class="dia">${esc(nombreDia(x.fecha))}</h3><ul class="movs">`;
      diaActual = dia;
    }
    const m = modelos.find(y => y.id === x.modeloId);
    const detalle = [`Talle ${x.talle}`, x.motivo, x.nota].filter(Boolean).join(' · ');
    html += `<li class="mov ${esc(x.tipo)}">
      <img src="${esc(m ? fotoPrincipal(m) : 'img/logo.webp')}" alt="" loading="lazy" width="44" height="54">
      <span class="mov-delta">${x.delta > 0 ? '+' : '−'}${Math.abs(x.delta)}</span>
      <span class="mov-texto"><b>${esc(x.modelo)}</b><span>${esc(detalle)}</span></span>
      <span class="mov-hora">${formatoHora.format(x.fecha)}</span>
    </li>`;
  }
  $('#lista-movs').innerHTML = html + '</ul>';
}

$('#filtro-modelo').addEventListener('click', e => {
  if (!e.target.closest('#quitar-filtro')) return;
  filtroMovModelo = null;
  renderVista();
});

// ---------------------------------------------------------------- cartel: registrar alta / baja

const cartel = $('#cartel');
let reg = null;

function abrirRegistro(tipo, modeloId) {
  reg = { tipo, modeloId: null, talle: null, cantidad: 1, motivo: MOTIVOS[tipo][0] };
  cartel.classList.toggle('alta', tipo === 'alta');
  cartel.classList.toggle('baja', tipo === 'baja');
  $('#cartel-titulo').textContent = tipo === 'alta' ? 'Registrar alta' : 'Registrar baja';
  $('#reg-buscar').value = '';
  $('#reg-nota').value = '';
  $('#reg-cantidad').value = 1;
  if (modeloId) elegirModelo(modeloId); else renderCartel();
  cartel.showModal();
  if (!modeloId && esCompu()) $('#reg-buscar').focus();
  else cartel.querySelector('.cartel-cuerpo').scrollTop = 0;
}

const modeloReg = () => modelos.find(m => m.id === reg?.modeloId);
const stockReg = () => modeloReg()?.talles?.[reg.talle] || 0;

function elegirModelo(id) {
  reg.modeloId = id;
  reg.talle = null;
  const m = modeloReg();
  // Si hay un solo talle posible, se elige solo.
  const posibles = Object.keys(m?.talles || {}).filter(t => reg.tipo === 'alta' || (m.talles[t] || 0) > 0);
  if (posibles.length === 1) reg.talle = posibles[0];
  renderCartel();
}

function renderCartel() {
  if (!reg) return;
  const m = modeloReg();
  if (reg.modeloId && !m) reg.modeloId = null;

  // Paso 1: modelo
  $('#reg-selector').hidden = !!m;
  $('#reg-modelo-elegido').hidden = !m;
  if (m) {
    $('#reg-modelo-elegido').innerHTML = `
      <img src="${esc(fotoPrincipal(m))}" alt="" width="40" height="50">
      <span><b>${esc(m.nombre)}</b><small>${esc([m.marca, m.color].filter(Boolean).join(' · '))} · ${totalModelo(m)} en stock</small></span>
      <button class="btn btn-borde" type="button" id="reg-cambiar">Cambiar</button>`;
  } else {
    renderOpcionesModelo();
  }

  // Paso 2: talle
  $('#paso-talle').hidden = !m;
  if (m) {
    $('#reg-talles').innerHTML = ordenarTalles(Object.keys(m.talles || {})).map(t => {
      const n = m.talles[t] || 0;
      const sinStock = reg.tipo === 'baja' && n <= 0;
      return `<button type="button" class="opcion-talle" role="radio" data-talle="${esc(t)}"
        aria-checked="${reg.talle === t}" ${sinStock ? 'disabled' : ''}>
        <b>${esc(t)}</b><small>hay ${n}</small></button>`;
    }).join('') || '<p class="vacio">Este modelo no tiene talles. Agregalos en "Editar".</p>';
  }

  // Pasos 3 y 4: cantidad y motivo
  const conTalle = !!(m && reg.talle);
  $('#paso-cantidad').hidden = !conTalle;
  $('#paso-motivo').hidden = !conTalle;
  $('#reg-motivos').innerHTML = MOTIVOS[reg.tipo].map(x =>
    `<button type="button" class="opcion-motivo" role="radio" data-motivo="${esc(x)}" aria-checked="${reg.motivo === x}">${esc(x)}</button>`
  ).join('');

  actualizarResumen();
}

function renderOpcionesModelo() {
  const q = normalizar($('#reg-buscar').value);
  const lista = modelos.filter(m => !q || normalizar(`${m.nombre} ${m.marca} ${m.color}`).includes(q));
  $('#reg-opciones').innerHTML = lista.map(m => {
    const t = totalModelo(m);
    const sinStock = reg.tipo === 'baja' && t === 0;
    return `<li><button type="button" class="opcion-modelo" data-id="${esc(m.id)}" ${sinStock ? 'disabled' : ''}>
      <img src="${esc(fotoPrincipal(m))}" alt="" loading="lazy" width="40" height="50">
      <span><b>${esc(m.nombre)}</b><small>${esc([m.marca, m.color].filter(Boolean).join(' · '))}</small></span>
      <span class="opcion-total">${sinStock ? 'sin stock' : `${t} en stock`}</span>
    </button></li>`;
  }).join('') || '<li class="vacio">No hay modelos con ese nombre.</li>';
}

function leerCantidad() {
  return Math.max(0, Math.floor(Number($('#reg-cantidad').value) || 0));
}

function actualizarResumen() {
  const r = $('#reg-resumen');
  const ok = $('#reg-ok');
  const m = modeloReg();
  const signo = reg.tipo === 'alta' ? '+' : '−';
  const palabra = reg.tipo === 'alta' ? 'alta' : 'baja';
  r.classList.remove('error');
  ok.textContent = `Registrar ${palabra}`;
  ok.disabled = true;
  if (!m) { r.textContent = 'Elegí el modelo.'; return; }
  if (!reg.talle) { r.textContent = 'Elegí el talle.'; return; }
  const cant = leerCantidad();
  if (!cant) { r.textContent = 'Poné la cantidad.'; return; }
  const hay = stockReg();
  const queda = reg.tipo === 'alta' ? hay + cant : hay - cant;
  if (queda < 0) {
    r.classList.add('error');
    r.textContent = `Del talle ${reg.talle} hay ${hay}. No se puede dar de baja ${cant}.`;
    return;
  }
  r.innerHTML = `${esc(m.nombre)} · talle <b>${esc(reg.talle)}</b>: hay <b>${hay}</b> <span class="flecha">→</span> quedan <b>${queda}</b>`;
  ok.textContent = `Registrar ${palabra} (${signo}${cant})`;
  ok.disabled = false;
}

$('#reg-buscar').addEventListener('input', renderOpcionesModelo);
$('#reg-buscar').addEventListener('keydown', e => {
  // Enter con un solo resultado lo elige.
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const opciones = [...document.querySelectorAll('.opcion-modelo:not(:disabled)')];
  if (opciones.length === 1) elegirModelo(opciones[0].dataset.id);
});

cartel.addEventListener('click', e => {
  const opcion = e.target.closest('.opcion-modelo');
  if (opcion) { elegirModelo(opcion.dataset.id); return; }
  if (e.target.closest('#reg-cambiar')) {
    reg.modeloId = null; reg.talle = null;
    $('#reg-buscar').value = '';
    renderCartel();
    if (esCompu()) $('#reg-buscar').focus();
    return;
  }
  const talle = e.target.closest('.opcion-talle');
  if (talle && !talle.disabled) {
    reg.talle = talle.dataset.talle;
    vibrar();
    renderCartel();
    return;
  }
  const motivo = e.target.closest('.opcion-motivo');
  if (motivo) { reg.motivo = motivo.dataset.motivo; renderCartel(); }
});

$('#reg-cantidad').addEventListener('input', actualizarResumen);
$('#reg-cantidad').addEventListener('focus', e => e.target.select());
$('#reg-menos').addEventListener('click', () => { $('#reg-cantidad').value = Math.max(1, leerCantidad() - 1); actualizarResumen(); });
$('#reg-mas').addEventListener('click', () => { $('#reg-cantidad').value = leerCantidad() + 1; actualizarResumen(); });

$('#form-registro').addEventListener('submit', async e => {
  e.preventDefault();
  const m = modeloReg();
  const cant = leerCantidad();
  if (!m || !reg.talle || !cant) return;
  const hay = stockReg();
  if (reg.tipo === 'baja' && cant > hay) return;
  const delta = reg.tipo === 'alta' ? cant : -cant;
  const nota = $('#reg-nota').value.trim();
  const { tipo, talle, motivo } = reg;
  cartel.close();
  vibrar();
  const movId = await datos.mover(m, talle, delta, tipo, { motivo, nota });
  toast(`${tipo === 'alta' ? 'Alta' : 'Baja'}: ${m.nombre} talle ${talle} (${delta > 0 ? '+' : '−'}${cant})`, { deshacer: movId });
});

cartel.addEventListener('close', () => { reg = null; });

// ---------------------------------------------------------------- crear / editar modelo

const hojaForm = $('#hoja-form');
const formModelo = $('#form-modelo');
let formCtx = null;

function abrirForm(m) {
  formCtx = { m, fotoData: m?.fotoData || null, talles: new Set(m ? Object.keys(m.talles || {}) : TALLES_BASE) };
  $('#hf-titulo').textContent = m ? 'Editar modelo' : 'Nuevo modelo';
  formModelo.nombre.value = m?.nombre || '';
  formModelo.marca.value = m?.marca || '';
  formModelo.color.value = m?.color || '';
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

  const precio = formModelo.precio.value === '' ? null : Math.max(0, Math.round(Number(formModelo.precio.value)));
  const talles = Object.fromEntries([...formCtx.talles].map(t => [t, m?.talles?.[t] || 0]));
  const datosModelo = {
    nombre,
    marca: formModelo.marca.value.trim(),
    color: formModelo.color.value.trim(),
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
    } else {
      // Recién creado: se abre el cartel de alta para cargarle el stock.
      abrirRegistro('alta', id);
      toast('Modelo creado. Cargale el stock.');
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
let movParaDeshacer = null;
if (!elToast.showPopover) elToast.hidden = true;

function toast(texto, { error = false, deshacer = null } = {}) {
  $('#toast-texto').textContent = texto;
  elToast.classList.toggle('error', error);
  movParaDeshacer = deshacer;
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
  timerToast = setTimeout(cerrarToast, deshacer ? 6000 : 3000);
}

function cerrarToast() {
  if (elToast.hidePopover && elToast.matches(':popover-open')) elToast.hidePopover();
  else elToast.hidden = true;
}

$('#toast-deshacer').addEventListener('click', async () => {
  const id = movParaDeshacer;
  if (!id) return;
  movParaDeshacer = null;
  cerrarToast();
  vibrar();
  await datos.deshacer(id);
  toast('Listo, se deshizo.');
});
})();
