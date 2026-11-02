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

const POCO_STOCK = 2;
const TALLES_OPCIONES = ['26', '28', '30', '32', '34', '36', '38', '40', 'S', 'M', 'L', 'XL'];
const NOMBRE_TIPO = { venta: 'Venta', ingreso: 'Entrada', ajuste: 'Corrección' };

let modelos = [];
let movs = [];
let modelosCargados = false;
let filtro = 'todos';
let busqueda = '';
let abiertoId = null;
let ultimoTocado = null;
let filtroMovModelo = null;
let desuscribir = [];

// ---------------------------------------------------------------- ingreso

datos.onUsuario(u => (u ? iniciarApp() : mostrarLogin()));

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

function iniciarApp() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#aviso-prueba').hidden = !MODO_PRUEBA;
  if (desuscribir.length) return;
  const alError = () => toast('No tenés permiso para ver el stock. Revisá el usuario.', { error: true });
  desuscribir.push(datos.onModelos(lista => {
    modelos = lista;
    modelosCargados = true;
    renderLista();
    if (abiertoId) renderHoja();
  }, alError));
  desuscribir.push(datos.onMovimientos(lista => {
    movs = lista;
    renderMovs();
  }, alError));
}

addEventListener('tss-error', () => toast('No se pudo guardar. Revisá la conexión.', { error: true }));

// ---------------------------------------------------------------- lista de modelos

const pasaFiltro = m => {
  const t = totalModelo(m);
  return filtro === 'con' ? t > 0 : filtro === 'sin' ? t === 0 : filtro === 'bajo' ? t > 0 && t <= POCO_STOCK : true;
};

function renderLista() {
  const q = normalizar(busqueda);
  const buscados = modelos.filter(m => !q || normalizar(`${m.nombre} ${m.marca} ${m.color}`).includes(q));
  const visibles = buscados.filter(pasaFiltro);

  const unidades = modelos.reduce((s, m) => s + totalModelo(m), 0);
  $('#barra-total').innerHTML = `<b>${unidades}</b> unidades`;

  const cuenta = { todos: buscados.length };
  for (const f of ['con', 'sin', 'bajo']) {
    const antes = filtro; filtro = f;
    cuenta[f] = buscados.filter(pasaFiltro).length;
    filtro = antes;
  }
  document.querySelectorAll('.filtros .chip').forEach(b => {
    const nombre = b.textContent.replace(/\s*\d+$/, '');
    b.innerHTML = `${esc(nombre)} <span class="n">${cuenta[b.dataset.filtro]}</span>`;
  });

  $('#lista-modelos').innerHTML = visibles.map(m => {
    const total = totalModelo(m);
    const talles = ordenarTalles(Object.keys(m.talles || {}))
      .map(t => {
        const n = m.talles[t] || 0;
        return `<span class="mini-talle ${n ? 'hay' : 'cero'}">${esc(t)}·${n}</span>`;
      }).join('');
    return `<li><button class="modelo ${total ? '' : 'agotado'}" data-id="${esc(m.id)}" type="button">
      <img src="${esc(fotoPrincipal(m))}" alt="" loading="lazy" width="64" height="80">
      <span class="modelo-info">
        <p class="modelo-marca">${esc(m.marca)}</p>
        <p class="modelo-nombre">${esc(m.nombre)}</p>
        <span class="mini-talles">${talles}</span>
      </span>
      <span class="modelo-total">${total}<small>${total === 1 ? 'unidad' : 'unid.'}</small></span>
    </button></li>`;
  }).join('');

  const sinNada = modelosCargados && modelos.length === 0;
  $('#vacio-modelos').hidden = !sinNada;
  if (!sinNada && modelosCargados && visibles.length === 0) {
    $('#lista-modelos').innerHTML = '<li class="vacio"><p>No hay modelos con ese filtro.</p></li>';
  }
}

$('#buscar').addEventListener('input', e => { busqueda = e.target.value; renderLista(); });

document.querySelector('.filtros').addEventListener('click', e => {
  const b = e.target.closest('.chip');
  if (!b) return;
  filtro = b.dataset.filtro;
  document.querySelectorAll('.filtros .chip').forEach(x => {
    x.classList.toggle('activo', x === b);
    x.setAttribute('aria-selected', x === b);
  });
  renderLista();
});

$('#lista-modelos').addEventListener('click', e => {
  const b = e.target.closest('.modelo');
  if (b) abrirModelo(b.dataset.id);
});

$('#btn-iniciales').addEventListener('click', async e => {
  e.target.disabled = true;
  try { await datos.cargarIniciales(modelos.map(m => m.id)); }
  catch { toast('No se pudieron cargar. Revisá la conexión.', { error: true }); }
  e.target.disabled = false;
});

// ---------------------------------------------------------------- hoja de un modelo

const hojaModelo = $('#hoja-modelo');
const modeloAbierto = () => modelos.find(m => m.id === abiertoId);

function abrirModelo(id) {
  abiertoId = id;
  ultimoTocado = null;
  renderHoja();
  if (!hojaModelo.open) hojaModelo.showModal();
}

function renderHoja() {
  const m = modeloAbierto();
  if (!m) { if (hojaModelo.open) hojaModelo.close(); return; }
  const total = totalModelo(m);
  $('#hm-foto').src = fotoPrincipal(m);
  $('#hm-marca').textContent = [m.marca, m.color].filter(Boolean).join(' · ');
  $('#hm-nombre').textContent = m.nombre;
  $('#hm-total').textContent = `${total} ${total === 1 ? 'unidad' : 'unidades'} en stock`;

  $('#hm-talles').innerHTML = ordenarTalles(Object.keys(m.talles || {})).map(t => {
    const n = m.talles[t] || 0;
    const tt = esc(t);
    return `<div class="fila-talle" data-talle="${tt}">
      <span class="talle">Talle<b>${tt}</b></span>
      <button class="btn-paso menos" data-accion="menos" type="button" aria-label="Vendí uno del talle ${tt}" ${n > 0 ? '' : 'disabled'}>−</button>
      <button class="cant ${n ? '' : 'cero'} ${t === ultimoTocado ? 'pulso' : ''}" data-accion="cant" type="button" aria-label="Talle ${tt}: ${n} en stock. Cargar varios">${n}</button>
      <button class="btn-paso mas" data-accion="mas" type="button" aria-label="Entró uno del talle ${tt}">+</button>
    </div>`;
  }).join('') || '<p class="vacio">Este modelo no tiene talles. Agregalos en "Editar modelo".</p>';
}

$('#hm-talles').addEventListener('click', e => {
  const b = e.target.closest('[data-accion]');
  const m = modeloAbierto();
  if (!b || !m) return;
  const talle = b.closest('.fila-talle').dataset.talle;
  if (b.dataset.accion === 'menos') mover(m, talle, -1, 'venta');
  else if (b.dataset.accion === 'mas') mover(m, talle, 1, 'ingreso');
  else abrirCantidad(m, talle);
});

async function mover(m, talle, delta, tipo) {
  const actual = m.talles?.[talle] || 0;
  if (actual + delta < 0) {
    toast(`No hay stock suficiente del talle ${talle}.`, { error: true });
    return;
  }
  vibrar();
  ultimoTocado = talle;
  const movId = await datos.mover(m, talle, delta, tipo);
  const signo = delta > 0 ? '+' : '';
  toast(`${NOMBRE_TIPO[tipo]}: ${m.nombre} T${talle} ${signo}${delta}`, { deshacer: movId });
}

$('#hm-historial').addEventListener('click', () => {
  filtroMovModelo = abiertoId;
  hojaModelo.close();
  irA('movs');
});

$('#hm-editar').addEventListener('click', () => abrirForm(modeloAbierto()));

hojaModelo.addEventListener('close', () => { abiertoId = null; });

// ---------------------------------------------------------------- cargar / descargar varios

const hojaCant = $('#hoja-cant');
let cantCtx = null;

function abrirCantidad(m, talle) {
  cantCtx = { m, talle };
  $('#hc-titulo').textContent = `${m.nombre} · talle ${talle}`;
  $('#form-cant').op.value = 'ingreso';
  $('#hc-valor').value = 1;
  actualizarCantidad();
  hojaCant.showModal();
}

function calcularCantidad() {
  const actual = cantCtx.m.talles?.[cantCtx.talle] || 0;
  const op = $('#form-cant').op.value;
  const v = Math.max(0, Math.floor(Number($('#hc-valor').value) || 0));
  const delta = op === 'ingreso' ? v : op === 'venta' ? -v : v - actual;
  return { actual, op, v, delta, queda: actual + delta };
}

function actualizarCantidad() {
  const { actual, delta, queda } = calcularCantidad();
  const r = $('#hc-resultado');
  r.classList.toggle('error', queda < 0);
  r.innerHTML = queda < 0
    ? `Solo hay ${actual}. No se puede vender más de eso.`
    : `Hay <b>${actual}</b> → van a quedar <b>${queda}</b>${delta === 0 ? ' (sin cambios)' : ''}`;
  $('#hc-ok').disabled = queda < 0 || delta === 0;
}

$('#form-cant').addEventListener('change', e => {
  if (e.target.name === 'op') {
    const actual = cantCtx.m.talles?.[cantCtx.talle] || 0;
    $('#hc-valor').value = e.target.value === 'ajuste' ? actual : 1;
  }
  actualizarCantidad();
});
$('#hc-valor').addEventListener('input', actualizarCantidad);
$('#hc-valor').addEventListener('focus', e => e.target.select());
$('#hc-menos').addEventListener('click', () => { $('#hc-valor').value = Math.max(0, (Number($('#hc-valor').value) || 0) - 1); actualizarCantidad(); });
$('#hc-mas').addEventListener('click', () => { $('#hc-valor').value = (Number($('#hc-valor').value) || 0) + 1; actualizarCantidad(); });

$('#form-cant').addEventListener('submit', e => {
  e.preventDefault();
  const { op, delta, queda } = calcularCantidad();
  if (queda < 0 || delta === 0) return;
  hojaCant.close();
  // Se busca el modelo de nuevo por si cambió mientras la hoja estaba abierta.
  const m = modelos.find(x => x.id === cantCtx.m.id) || cantCtx.m;
  mover(m, cantCtx.talle, delta, op);
});

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
  if (hojaModelo.open) hojaModelo.close();
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
    abrirModelo(id);
    toast(m ? 'Modelo actualizado.' : 'Modelo creado. Cargá el stock.');
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

$('#btn-nuevo').addEventListener('click', () => abrirForm(null));

// ---------------------------------------------------------------- movimientos

const formatoHora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const formatoDia = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
const claveDia = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function nombreDia(d) {
  const hoy = new Date();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (claveDia(d) === claveDia(hoy)) return 'Hoy';
  if (claveDia(d) === claveDia(ayer)) return 'Ayer';
  return formatoDia.format(d);
}

function renderMovs() {
  const lista = filtroMovModelo ? movs.filter(x => x.modeloId === filtroMovModelo) : movs;

  const hoy = claveDia(new Date());
  const deHoy = lista.filter(x => claveDia(x.fecha) === hoy);
  const vendidos = deHoy.filter(x => x.tipo === 'venta').reduce((s, x) => s - x.delta, 0);
  const entraron = deHoy.filter(x => x.tipo === 'ingreso').reduce((s, x) => s + x.delta, 0);
  $('#resumen-hoy').innerHTML = `
    <div class="dato venta"><p>Vendidas hoy</p><b>${vendidos}</b></div>
    <div class="dato ingreso"><p>Entraron hoy</p><b>${entraron}</b></div>
    <div class="dato"><p>Movimientos hoy</p><b>${deHoy.length}</b></div>`;

  const fm = $('#filtro-modelo');
  fm.hidden = !filtroMovModelo;
  if (filtroMovModelo) {
    const m = modelos.find(x => x.id === filtroMovModelo);
    fm.innerHTML = `<button class="chip" type="button" id="quitar-filtro" aria-label="Ver todos los modelos">${esc(m?.nombre || 'Modelo')} ✕</button>`;
  }

  if (!lista.length) {
    $('#lista-movs').innerHTML = '<p class="vacio">Todavía no hay movimientos.</p>';
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
    const signo = x.delta > 0 ? '+' : '';
    html += `<li class="mov ${esc(x.tipo)}">
      <span class="mov-delta">${signo}${x.delta}</span>
      <span class="mov-texto"><b>${esc(x.modelo)}</b><span>Talle ${esc(x.talle)} · ${NOMBRE_TIPO[x.tipo] || esc(x.tipo)}</span></span>
      <span class="mov-hora">${formatoHora.format(x.fecha)}</span>
    </li>`;
  }
  $('#lista-movs').innerHTML = html + '</ul>';
}

$('#filtro-modelo').addEventListener('click', e => {
  if (!e.target.closest('#quitar-filtro')) return;
  filtroMovModelo = null;
  renderMovs();
});

// ---------------------------------------------------------------- navegación, hojas y avisos

function irA(vista) {
  $('#vista-stock').hidden = vista !== 'stock';
  $('#vista-movs').hidden = vista !== 'movs';
  document.querySelectorAll('.tab[data-vista]').forEach(t => t.classList.toggle('activo', t.dataset.vista === vista));
  if (vista === 'movs') renderMovs();
  scrollTo(0, 0);
}

document.querySelectorAll('.tab[data-vista]').forEach(t => t.addEventListener('click', () => {
  if (t.dataset.vista === 'movs' && !$('#vista-movs').hidden) return;
  if (t.dataset.vista === 'movs') filtroMovModelo = null;
  irA(t.dataset.vista);
}));

document.querySelectorAll('dialog').forEach(d => {
  // Cierra al tocar afuera (el fondo oscuro) o una X; tocar el borde de la hoja no la cierra.
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
  // Una hoja abierta bloquea todo lo de afuera: el aviso se mete adentro para que "Deshacer" funcione.
  const hojaAbierta = [...document.querySelectorAll('dialog[open]')].pop() || document.body;
  if (elToast.parentElement !== hojaAbierta) hojaAbierta.append(elToast);
  if (elToast.showPopover) {
    // Se vuelve a abrir para que quede arriba de cualquier hoja abierta.
    if (elToast.matches(':popover-open')) elToast.hidePopover();
    elToast.showPopover();
  } else {
    elToast.hidden = false;
  }
  clearTimeout(timerToast);
  timerToast = setTimeout(cerrarToast, deshacer ? 5000 : 3000);
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
