

document.addEventListener("DOMContentLoaded", function () {
  // Obtener el campo de fecha de inicio y fin
  const fechaInicioInput = document.getElementById("fechaInicio");
  const fechaFinInput = document.getElementById("fechaFin");

  // Obtener la fecha de hoy en formato YYYY-MM-DD
  const hoy = new Date();
  const fechaHoy = hoy.toISOString().split('T')[0];

  // Establecer el valor por defecto en el input
  fechaInicioInput.value = fechaHoy;
  fechaFinInput.value = fechaHoy;
});

// Paginación
document.querySelectorAll('.opcion-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    const page = this.getAttribute('data-page');
    document.querySelectorAll('.vista').forEach(vista => {
      vista.style.display = 'none';
    });
    document.getElementById('vista' + page).style.display = 'block';
  });
});

// === NAV ENTRE VISTA 1 Y 2 ===
document.addEventListener('DOMContentLoaded', () => {
  const vista1 = document.getElementById('vista1');
  const vista2 = document.getElementById('vista2');
  const tabV2 = document.querySelector('.opcion-btn[data-page="2"]'); // tu tab/botón para la vista 2
  const tabs = Array.from(document.querySelectorAll('.opcion-btn[data-page]'));

  // util: visibilidad robusta
  const isVisible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  // crea contenedores para botones si no existen
  function ensureSlot(viewEl, id) {
    if (!viewEl) return null;
    let slot = document.getElementById(id);
    if (!slot) {
      slot = document.createElement('div');
      slot.id = id;
      slot.className = 'nav-row';
      slot.style.marginTop = '12px';
      viewEl.appendChild(slot);
    }
    return slot;
  }
  const slotV1 = ensureSlot(vista1, 'nav-slot-v1');
  const slotV2 = ensureSlot(vista2, 'nav-slot-v2');

  // crea botones
  const btnSig = document.createElement('button');
  btnSig.id = 'btn-siguiente';
  btnSig.type = 'button';
  btnSig.textContent = 'Siguiente';

  const btnVolver = document.createElement('button');
  btnVolver.id = 'btn-volver';
  btnVolver.type = 'button';
  btnVolver.textContent = 'Volver';

  slotV1?.appendChild(btnSig);
  slotV2?.appendChild(btnVolver);

  // fallback de paginación si no existe mostrarVista
  function goTo(n) {
    if (typeof window.mostrarVista === 'function') {
      window.mostrarVista(n);
      return;
    }
    // fallback: oculta/muestra directamente
    document.querySelectorAll('.vista').forEach(v => v && (v.style.display = 'none'));
    const target = document.getElementById(`vista${n}`);
    if (target) target.style.display = 'block';
    // marcar tabs activos si existen
    tabs.forEach(b => b.classList.remove('activo'));
    document.querySelector(`.opcion-btn[data-page="${n}"]`)?.classList.add('activo');
  }

  // vista 2 aplica solo si tu tab de la 2 NO está oculto por tu lógica
  const vista2Aplica = () => !tabV2?.classList.contains('oculta');

  // ¿estoy parado en la vista 2?
  const enVista2 = () => isVisible(vista2) && (!vista1 || !isVisible(vista1));

  // mapea config por id
  const CFG = Object.fromEntries((window.CAMPOS || []).map(c => [c.id, c]));
  // ids de campos que están físicamente dentro de vista1
  const IDS_V1 = (window.CAMPOS || [])
    .map(c => c.id)
    .filter(id => {
      const el = document.getElementById(id);
      return el && vista1?.contains(el);
    });

  function vista1Completa() {
    for (const id of IDS_V1) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (el.disabled) continue;
      if (el.dataset.naApplied === '1') continue;
      const v = (el.value ?? '').toString().trim();
      if (el.readOnly && v !== '') continue;
      if (typeof window._invalido === 'function' && window._invalido(el, CFG[id] || {})) {
        return false;
      }
    }
    return true;
  }

  function focusPrimerInvalidoV1() {
    for (const id of IDS_V1) {
      const el = document.getElementById(id);
      if (!el || el.disabled || el.dataset.naApplied === '1') continue;
      const v = (el.value ?? '').toString().trim();
      if (el.readOnly && v !== '') continue;
      if (typeof window._invalido === 'function' && window._invalido(el, CFG[id] || {})) {
        el.focus();
        break;
      }
    }
  }

  function updateNav() {
    // si la vista 2 NO aplica, ocultar ambos
    if (!vista2Aplica()) {
      slotV1 && (slotV1.style.display = 'none');
      slotV2 && (slotV2.style.display = 'none');
      return;
    }
    // si estoy en la 2 → solo Volver
    if (enVista2()) {
      slotV1 && (slotV1.style.display = 'none');
      slotV2 && (slotV2.style.display = '');
    } else {
      // estoy en la 1 → solo Siguiente (y puede estar disabled)
      slotV1 && (slotV1.style.display = '');
      slotV2 && (slotV2.style.display = 'none');
      btnSig.disabled = !vista1Completa();
    }
  }

  // eventos
  btnSig.addEventListener('click', () => {
    if (!vista1Completa()) {
      focusPrimerInvalidoV1();
      return;
    }
    if (typeof window.bloquearCamposProgresivo === 'function') window.bloquearCamposProgresivo();
    goTo(2);
    setTimeout(updateNav, 0);
  });

  btnVolver.addEventListener('click', () => {
    goTo(1);
    setTimeout(updateNav, 0);
  });

  // re-evaluar cuando cambien campos de la vista1
  IDS_V1.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const evt = (CFG[id]?.tipo === 'select') ? 'change' : 'input';
    el.addEventListener(evt, () => {
      if (typeof window.bloquearCamposProgresivo === 'function') window.bloquearCamposProgresivo();
      updateNav();
    });
  });

  // cuando cambie Actividad (puede ocultar/mostrar la vista 2 por tu lógica)
  document.getElementById('actividad')?.addEventListener('change', () => {
    if (typeof window.bloquearCamposProgresivo === 'function') window.bloquearCamposProgresivo();
    setTimeout(updateNav, 0);
  });

  // si tus tabs cambian de vista, refresca botones después de click
  tabs.forEach(tab => {
    tab.addEventListener('click', () => setTimeout(updateNav, 0));
  });

  // observar cambios de estilo/clase en vistas (por si otro código pagina)
  const obs = new MutationObserver(() => updateNav());
  vista1 && obs.observe(vista1, { attributes: true, attributeFilter: ['style', 'class'] });
  vista2 && obs.observe(vista2, { attributes: true, attributeFilter: ['style', 'class'] });
  tabV2 && obs.observe(tabV2, { attributes: true, attributeFilter: ['class'] });

  // estado inicial
  if (typeof window.bloquearCamposProgresivo === 'function') window.bloquearCamposProgresivo();
  updateNav();
});


//////////////////////////////////////////////////////////////////////////////////////////////

function mostrarOpcion(elemento) { }

function resaltarOption(elemento) {
  const cont = elemento.closest('.options');
  if (!cont) return;
  cont.querySelectorAll('p').forEach(op => op.classList.remove('activo'));
  elemento.classList.add('activo');
}

// Mostrar calculadora seleccionada
function mostrarCalculadora(num) {
  // Ocultar todas
  document.querySelectorAll(".calculadora").forEach(div => {
    div.style.display = "none";
  });

  // Mostrar la seleccionada
  const calc = document.getElementById(`calc${num}`);
  if (calc) calc.style.display = "block";

  // 🔹 Sincronizar el borde en el bloque .options de la calculadora mostrada
  const cont = calc?.querySelector('.options');
  if (cont) {
    cont.querySelectorAll('p').forEach(p => p.classList.remove('activo'));
    const target = cont.querySelector(`p:nth-child(${num})`);
    if (target) target.classList.add('activo');
  }
}
// === Cálculo en tiempo real para la básica ===
// === Cálculo en tiempo real para la básica ===
function calcularBasicaEnVivo() {
  const out = document.getElementById("resultado");
  if (!out) return;

  const v1 = document.getElementById("num1")?.value.trim() ?? "";
  const op = document.getElementById("operador")?.value.trim() ?? "";
  const v2 = document.getElementById("num2")?.value.trim() ?? "";

  if (v1 === "" && v2 === "" && op === "") { out.textContent = ""; return; }
  if (v1 === "" || v2 === "") { out.textContent = "Resultado: —"; return; }

  const n1 = parseFloat(v1), n2 = parseFloat(v2);
  if (!isFinite(n1) || !isFinite(n2)) { out.textContent = "Resultado: —"; return; }

  const map = { "x": "*", "×": "*", "÷": "/" };
  const o = map[op] || op;

  let resultado;
  switch (o) {
    case "+": resultado = n1 + n2; break;
    case "-": resultado = n1 - n2; break;
    case "*": resultado = n1 * n2; break;
    case "/": resultado = (n2 === 0) ? "No se puede dividir entre 0" : (n1 / n2); break;
    default: out.textContent = "Operador no válido (usa + - * /)"; return;
  }

  const pretty = (typeof resultado === "number")
    ? (Number.isInteger(resultado) ? resultado : Number(resultado.toFixed(6)))
    : resultado;

  out.textContent = "Resultado: " + pretty;

  // Enviar a #cantidad si existe y la función también
  if (typeof resultado === 'number' && isFinite(resultado) && typeof setCantidadFromResult === 'function') {
    setCantidadFromResult(resultado);
  }
}

// 🔧 1) Volver a enganchar los inputs al cálculo en vivo
["num1", "operador", "num2"].forEach(id => {
  const el = document.getElementById(id);
  el?.addEventListener("input", calcularBasicaEnVivo);
});

// --- Foco y teclado numérico (ya lo tenías) ---
const EDITABLES = ['num1', 'operador', 'num2'];
let ultimoInput = 'num1';

document.addEventListener('focusin', (e) => {
  const id = e.target?.id;
  if (EDITABLES.includes(id)) ultimoInput = id;
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.numeros button').forEach(btn => {
    btn.addEventListener('mousedown', e => e.preventDefault());
  });
});

// Insertar donde esté el foco/último input
function insertarNumero(dig) {
  let target = document.activeElement;
  if (!target || !EDITABLES.includes(target.id)) {
    target = document.getElementById(ultimoInput) || document.getElementById('num1');
  }
  if (target.id === 'operador') {
    target = document.getElementById('num2') || target;
    target.focus();
    ultimoInput = 'num2';
  }

  if (target.type === 'number' || target.selectionStart == null || typeof target.setRangeText !== 'function') {
    target.value = (target.value ?? '') + String(dig);
  } else {
    const start = target.selectionStart, end = target.selectionEnd;
    target.setRangeText(String(dig), start, end, 'end');
  }

  target.dispatchEvent(new Event('input', { bubbles: true }));
  calcularBasicaEnVivo();
}
window.insertarNumero = insertarNumero; // si usas onclick inline

// 🔧 2) Corregir variable: inputActivo -> ultimoInput
document.getElementById("operador")?.addEventListener("input", (e) => {
  const valor = e.target.value.trim();
  if (["+", "-", "*", "/", "x", "×", "÷"].includes(valor)) {
    ultimoInput = "num2";
    document.getElementById("num2")?.focus();
  }
});

// Botón borrar
document.getElementById("flecha-borrar")?.addEventListener("click", limpiarCalculadoraBasica);

// 🔧 3) Limpiar usando el id correcto de cantidad
function limpiarCalculadoraBasica() {
  document.getElementById("num1").value = "";
  document.getElementById("operador").value = "";
  document.getElementById("num2").value = "";
  document.getElementById("resultado").textContent = "";
  document.getElementById("campo-cantidad") && (document.getElementById("campo-cantidad").value = "");
}



/* LÓGICA CALCULADORA ROLLOS A METROS */
function calcularRollos() {
  let rollos = parseFloat(document.getElementById("rollos").value);
  let avance = parseFloat(document.getElementById("avance").value);
  let lineas = parseFloat(document.getElementById("lineas").value);
  let etiquetas = parseFloat(document.getElementById("etiquetas").value);
  let resultado;

  if (isNaN(rollos) || isNaN(avance) || isNaN(lineas) || isNaN(etiquetas)) {
    resultado = "Por favor ingresa todos los datos.";
    document.getElementById("resultado2").innerText = "Resultado: " + resultado;
    return;
  }

  const valor = (rollos * etiquetas * (avance / lineas)) / 100;
  resultado = Number(valor.toFixed(2));

  document.getElementById("resultado2").innerText = "Metros: " + resultado;
  setCantidadFromResult(valor);
}



function calcularEtiquetas() {
  let numeroEtiquetas = parseFloat(document.getElementById("etiquetasTotal").value);
  let lineas = parseFloat(document.getElementById("lineasEtiquetas").value);
  let avanceReal = parseFloat(document.getElementById("avanceEtiquetas").value);

  if (isNaN(numeroEtiquetas) || isNaN(lineas) || isNaN(avanceReal)) {
    document.getElementById("resultado3").innerText = "Resultado: Por favor ingresa todos los datos.";
    return;
  }

  const valor = (numeroEtiquetas / lineas) * (avanceReal / 100);
  const resultado = Number(valor.toFixed(2));

  document.getElementById("resultado3").innerText = "Metros: " + resultado;
  setCantidadFromResult(valor);
}


function calcularMetrosEtiquetas() {
  let numeroMetros = parseFloat(document.getElementById("metrosTotal").value);
  let lineas = parseFloat(document.getElementById("lineasMetros").value);
  let avanceReal = parseFloat(document.getElementById("avanceMetros").value);
  let resultado;

  if (isNaN(numeroMetros) || isNaN(lineas) || isNaN(avanceReal)) {
    resultado = "Por favor ingresa todos los datos.";
  } else {
    // Fórmula: (numeroMetros * 100 / avanceReal) * lineas
    resultado = (numeroMetros * 100 / avanceReal) * lineas;
    resultado = resultado.toFixed(0); // Sin decimales, porque son etiquetas
  }

  document.getElementById("resultado4").innerText = "Etiquetas: " + resultado;
  setCantidadFromResult(resultado);
}

// === Helper: poner el último resultado en #cantidad ===
// === Poner el resultado en #campo-cantidad y avisar al validador ===
function setCantidadFromResult(val, { focusNext = true } = {}) {
  const inp = document.getElementById('campo-cantidad');
  if (!inp) return;

  const num = (typeof val === 'number') ? val : parseFloat(val);
  if (!isFinite(num)) return;

  const pretty = Number.isInteger(num) ? num : Number(num.toFixed(2));

  // Asegura que no esté marcado como N/A ni deshabilitado
  if (inp.dataset.naApplied === '1') delete inp.dataset.naApplied;
  if (inp.disabled) inp.disabled = false;

  // Asigna el valor y dispara eventos para que todo se actualice
  inp.value = String(pretty);
  if (typeof clearError === 'function') clearError(inp);

  ['input', 'change'].forEach(ev =>
    inp.dispatchEvent(new Event(ev, { bubbles: true }))
  );

  // Recalcula el bloqueo progresivo (usa el que tengas activo)
  if (typeof actualizarBloqueoGUI === 'function') {
    actualizarBloqueoGUI({ autofocusSugerido: false });
  } else if (typeof bloquearCamposProgresivo === 'function') {
    bloquearCamposProgresivo();
  }

  // Opcional: enfocar el siguiente campo habilitado
  if (focusNext && Array.isArray(CAMPOS)) {
    const idx = CAMPOS.findIndex(c => c.id === 'campo-cantidad');
    for (let i = idx + 1; i < CAMPOS.length; i++) {
      const nextEl = document.getElementById(CAMPOS[i].id);
      if (nextEl && !nextEl.disabled) { nextEl.focus(); break; }
    }
  }
}


const botones = document.querySelectorAll('.opcion-btn');

botones.forEach(btn => {
  btn.addEventListener('click', () => {
    // Quitar la clase activo a todos
    botones.forEach(b => b.classList.remove('activo'));
    // Agregarla solo al que se clickeó
    btn.classList.add('activo');
  });
});

// Activar el primero por defecto
botones[0].classList.add('activo');


/* ---------------------VALIDACIÓN----------------------------------------------------------*/

// Campos obligatorios en orden
const CAMPOS = [
  { id: "id", nombre: "Identificación", tipo: "número", pattern: "^[0-9]{6,12}$", msg: "La identificación debe tener 6 dígitos como mínimo" },
  { id: "nombre", nombre: "Nombre" },
  { id: "actividad", nombre: "Actividad", tipo: "select" },

  { id: "sede", nombre: "Sede", tipo: "select" },
  { id: "fechaInicio", nombre: "Fecha Inicio", tipo: "fecha" },
  { id: "fechaFin", nombre: "Fecha Final", tipo: "fecha" },
  { id: "horaInicio", nombre: "Hora Inicio", tipo: "hora" },
  { id: "horaFin", nombre: "Hora Final", tipo: "hora" },

  { id: "op", nombre: "No. OP" },
  { id: "sci", nombre: "SCI Ref" },
  { id: "dr", nombre: "Descripción Referencia" },
  { id: "estado-sci", nombre: "Estado SCI", tipo: "select" },
  { id: "campo-cantidad", nombre: "Cantidad", tipo: "number+", min: 0.000001, step: "0.01" },
  { id: "ctpn", nombre: "CT Pn", tipo: "select" },
  { id: "maquina", nombre: "Máquina", tipo: "select" },

  { id: "horprog", nombre: "Horario", tipo: "select" },
  { id: "observacion", nombre: "Observaciones" }
];

// ================ HELPERS BASE ================
function _val(el) { return (el?.value ?? "").toString().trim(); }

function _invalido(el, cfg = {}) {
  if (!el) return true;

  // Si marcaste N/A en vista2, no validar ese campo
  if (el.dataset.naApplied === '1') return false;

  // Valor normalizado
  const raw = (typeof _val === 'function') ? _val(el) : el.value;
  const v = (raw == null ? '' : String(raw)).trim();

  // readonly + con valor => VÁLIDO (caso del Nombre autocompletado)
  if (el.readOnly && v !== '') return false;

  // Selects
  if (cfg.tipo === "select") {
    const opt = el.options[el.selectedIndex];
    return (
      v === "" ||
      v === "0" ||
      v.toLowerCase() === "default" ||
      (!!opt && opt.disabled === true)
    );
  }

  // Números: vacío es inválido (evita Number('') === 0)
  if (cfg.tipo && cfg.tipo.startsWith("number")) {
    if (v === '') return true;
    const n = Number(v);
    if (!isFinite(n)) return true;
    if (cfg.min != null && n < cfg.min) return true;
    if (cfg.max != null && n > cfg.max) return true;
    if (cfg.tipo === "number+" && n <= 0) return true;
    return false;
  }

  // Texto: vacío es inválido
  return v === "";
}

function choose(ident, nombre) {
  suppressSearch = true;          //  silenciar el listener de input
  debouncedSearch.cancel?.();     //  cancela búsquedas pendientes
  closeList();                    //  limpia antes de rellenar

  programmaticFill($id, String(ident));   // dispara input/change en #id
  if ($nombre.disabled) $nombre.disabled = false;
  $nombre.readOnly = true;
  $nombre.setCustomValidity && $nombre.setCustomValidity('');
  programmaticFill($nombre, nombre);      // dispara input/change en #nombre

  if (typeof bloquearCamposProgresivo === 'function') bloquearCamposProgresivo();
  if (typeof actualizarBloqueoGUI === 'function') actualizarBloqueoGUI();

  // suelta el flag al siguiente tick (ya pasó el input programático)
  setTimeout(() => { suppressSearch = false; }, 50);

  // enfoca el siguiente si ya está habilitado
  const next = document.getElementById('actividad');
  if (next && !next.disabled) next.focus();
}








/* ===== Utilidades de UI ===== */
function showError(inputEl, msg) {
  if (!inputEl) return;
  inputEl.classList.add('is-invalid');

  // si ya hay mensaje, actualízalo
  let help = inputEl.nextElementSibling;
  if (!help || !help.classList.contains('error-text')) {
    help = document.createElement('div');
    help.className = 'error-text';
    inputEl.insertAdjacentElement('afterend', help);
  }
  help.textContent = msg;
}

function clearError(inputEl) {
  if (!inputEl) return;
  inputEl.classList.remove('is-invalid');
  const help = inputEl.nextElementSibling;
  if (help && help.classList.contains('error-text')) {
    help.remove();
  }
}

/* ===== Validador principal ===== */
// ===== Validación de Fechas/Horas con SweetAlert en tiempo real =====
let _lastTimeError = null; // 'startInvalid' | 'endInvalid' | 'order' | 'over14' | null

function validarFechasYHorasInline() {
  const fiEl = document.getElementById('fechaInicio');
  const hiEl = document.getElementById('horaInicio');
  const ffEl = document.getElementById('fechaFin');
  const hfEl = document.getElementById('horaFin');

  const fi = fiEl?.value?.trim();
  const hi = hiEl?.value?.trim();
  const ff = ffEl?.value?.trim();
  const hf = hfEl?.value?.trim();

  // Si faltan datos: no bloquear, limpiar y resetear estado
  if (!(fi && hi && ff && hf)) {
    [fiEl, hiEl, ffEl, hfEl].forEach(el => el && clearError(el));
    _lastTimeError = null;
    return true;
  }

  const start = new Date(`${fi}T${hi}`);
  const end = new Date(`${ff}T${hf}`);

  // Helpers locales para marcar/desmarcar sin meter mensajes inline
  const markInvalid = (...els) => els.forEach(el => { if (el) { el.classList.add('is-invalid'); } });
  const unmarkAll = () => [fiEl, hiEl, ffEl, hfEl].forEach(el => el && clearError(el));

  // Resolver error y lanzar Swal (una sola vez por tipo de error)
  const raise = (code, msg, focusEl) => {
    if (_lastTimeError !== code && !Swal.isVisible()) {
      Swal.fire({
        title: 'Revisa fechas y horas',
        text: msg,
        icon: 'error',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#ed6b07',
        iconColor: '#e11d48',
        background: '#ebd5c0',
        color: '#000',
        backdrop: 'rgba(0,0,0,.6)',
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then(() => focusEl?.focus());
    }
    _lastTimeError = code;
    return false;
  };

  // Validaciones
  if (!isFinite(start)) {
    markInvalid(fiEl, hiEl);
    return raise('startInvalid', 'La fecha/hora de inicio no es válida.', fiEl || hiEl);
  } else {
    clearError(fiEl); clearError(hiEl);
  }

  if (!isFinite(end)) {
    markInvalid(ffEl, hfEl);
    return raise('endInvalid', 'La fecha/hora final no es válida.', ffEl || hfEl);
  } else {
    clearError(ffEl); clearError(hfEl);
  }

  if (end <= start) {
    markInvalid(ffEl, hfEl);
    return raise('order', 'La Fecha/Hora Final debe ser mayor que la Fecha/Hora Inicio.', hfEl || ffEl);
  }

  const diffHoras = (end - start) / 36e5;
  if (diffHoras > 14) {
    markInvalid(ffEl, hfEl);
    return raise('over14', 'La cantidad de tiempo laborado no puede superar las 14 horas.', hfEl || ffEl);
  }

  // Todo OK
  unmarkAll();
  _lastTimeError = null;
  return true;
}


/* ===== Enlazar eventos en tiempo real ===== */
document.addEventListener('DOMContentLoaded', () => {
  ['fechaInicio', 'horaInicio', 'fechaFin', 'horaFin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', validarFechasYHorasInline);
      el.addEventListener('change', validarFechasYHorasInline);
      el.addEventListener('blur', validarFechasYHorasInline);
    }
  });

  // Si usas un <form>, evita enviar si hay error
  const form = document.querySelector('form');
  if (form) {
    form.addEventListener('submit', (e) => {
      if (!validarFechasYHorasInline()) e.preventDefault();
    });
  }
});

/* ===== Helpers de UI (no sobrescriben si ya existen) ===== */
window.showError ??= function (inputEl, msg) {
  if (!inputEl) return;
  inputEl.classList.add('is-invalid');
  let help = inputEl.nextElementSibling;
  if (!help || !help.classList.contains('error-text')) {
    help = document.createElement('div');
    help.className = 'error-text';
    inputEl.insertAdjacentElement('afterend', help);
  }
  help.textContent = msg;
};

window.clearError ??= function (inputEl) {
  if (!inputEl) return;
  inputEl.classList.remove('is-invalid');
  const help = inputEl.nextElementSibling;
  if (help && help.classList.contains('error-text')) help.remove();
};

/* ===== Validación de campos obligatorios (usa CAMPOS y _invalido) ===== */
function validarCamposObligatorios() {
  const errores = [];
  let firstInvalid = null;

  for (const c of CAMPOS) {
    const el = document.getElementById(c.id);
    if (!el) continue;

    if (el.dataset.naApplied === '1') continue;
    // limpia estado previo
    clearError(el);

    // inválido según tus reglas personalizadas
    if (_invalido(el, c)) {
      const mensaje =
        c.mensaje || c.msg || el.dataset?.requiredMessage || 'Este campo es obligatorio.';
      showError(el, mensaje);
      errores.push(c.nombre || c.label || `#${c.id}`);
      if (!firstInvalid) firstInvalid = el;
    }
  }

  if (errores.length) {
    Swal.fire({
      title: 'Campos incompletos',
      html:
        `<p>Por favor completa los siguientes campos:</p>` +
        `<ul style="text-align:left;margin:8px 0 0 22px">` +
        errores.map(n => `<li>${n}</li>`).join('') +
        `</ul>`,
      icon: 'error',
      confirmButtonText: 'Ir al primero',
      confirmButtonColor: '#ed6b07',
      iconColor: '#e11d48',
      background: '#ebd5c0',
      color: '#000',
      backdrop: 'rgba(0,0,0,.6)',
      allowOutsideClick: false,
      allowEscapeKey: false
    }).then(() => {
      firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalid?.focus({ preventScroll: true });
    });
    return false;
  }

  // Si todos los obligatorios están ok, validamos las fechas/horas
  return validarFechasYHorasInline();
}

/* ===== Validador maestro del formulario ===== */
function validarFormularioCompleto() {
  // Ojo: tu validarFechasYHorasInline ya se ejecuta "live" por eventos,
  // aquí sólo bloquea el envío si algo está mal:
  return validarCamposObligatorios() && validarFechasYHorasInline();
}

/* ===== Enlaces de eventos para limpiar error al corregir ===== */
document.addEventListener('input', (e) => {
  const id = e.target?.id;
  if (!id || !Array.isArray(CAMPOS)) return;
  const c = CAMPOS.find(x => x.id === id);
  if (!c) return;
  // si ya es válido, limpiamos el rojo/mensaje en vivo
  if (!_invalido(e.target, c)) clearError(e.target);
});




// ========== BLOQUEO PROGRESIVO ==========
function bloquearCamposProgresivo() {
  let yaCorte = false;
  for (const c of CAMPOS) {
    const el = document.getElementById(c.id);
    if (!el) continue;

    // nunca deshabilitar 'cantidad'
    if (c.id === 'campo-cantidad') {
      el.disabled = false;
      continue;
    }

    if (!yaCorte && !_invalido(el, c)) {
      el.disabled = false;
    } else if (!yaCorte && _invalido(el, c)) {
      el.disabled = false; // primer inválido queda habilitado
      yaCorte = true;
    } else {
      el.disabled = true;  // lo siguiente al primer inválido se deshabilita
    }
  }
}


// Hook para refrescar el bloqueo cuando cambian campos
document.addEventListener('DOMContentLoaded', () => {
  CAMPOS.forEach(c => {
    const el = document.getElementById(c.id);
    if (!el) return;
    const evt = (c.tipo === 'select') ? 'change' : 'input';
    el.addEventListener(evt, bloquearCamposProgresivo);
  });
  bloquearCamposProgresivo();

  // Tab inicial
  setActiveTab(1);
  mostrarCalculadora(1);
});

// ========== NAVEGACIÓN ENTRE CALCULADORAS (sin validar nada) ==========
function mostrarCalculadora(num) {
  document.querySelectorAll(".calculadora").forEach(div => div.style.display = "none");
  const calc = document.getElementById(`calc${num}`);
  if (calc) calc.style.display = "block";

  // Sincroniza el borde activo en TODOS los bloques .options (si tienes tabs internos)
  document.querySelectorAll('.options').forEach(cont => {
    cont.querySelectorAll('p').forEach(p => p.classList.remove('activo'));
    const target = cont.querySelector(`p:nth-child(${num})`);
    if (target) target.classList.add('activo');
  });
}

function setActiveTab(num) {
  // Si tienes un bloque global con id="calc-tabs", lo marca; si no, los internos ya se sincronizan arriba
  const tabs = document.querySelectorAll("#calc-tabs p");
  if (tabs.length) {
    tabs.forEach(p => p.classList.remove("activo"));
    const t = document.querySelector(`#calc-tabs p:nth-child(${num})`);
    if (t) t.classList.add("activo");
  }
}

// ✅ No valides nada al navegar; solo cambia de calculadora
function validarYIr(el, num) {
  mostrarCalculadora(num);
  // Si quieres además marcar el clicado de inmediato en el bloque donde diste clic:
  if (typeof resaltarOption === 'function') resaltarOption(el);
  if (typeof mostrarOpcion === 'function') mostrarOpcion(el);
  setActiveTab(num);
}

// ===== helpers =====
const nn = (v) => {
  const s = (v ?? '').toString().trim();
  return s ? s : 'N/A';
};



// fallback a fetch si no existe tu helper window.gql
async function gqlRaw(query, variables) {
  const resp = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const json = await resp.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map(e => e.message).join('\n'));
  }
  return json.data;
}
async function gqlCall(query, variables) {
  if (typeof window.gql === 'function') {
    return await window.gql(query, variables);          // tu helper existente
  }
  return await gqlRaw(query, variables);                // fallback
}

// ===== mutation SDL =====
const MUTATION_CREAR = `
  mutation Crear($input: FormularioInput!) {
    crear_formulario(input: $input) {
      id
      cc
      created_at
    }
  }
`;

// ===== handler principal =====
async function enviarFormulario(e) {
  e?.preventDefault?.();

  // opcional: valida con tu función actual
  if (typeof validarFormularioCompleto === 'function' && !validarFormularioCompleto()) {
    if (window.Swal) {
      Swal.fire({
        title: 'Campos incompletos',
        text: 'Por favor completa los campos.',
        icon: 'error',
        confirmButtonColor: '#ed6b07',
        iconColor: '#e11d48',
        background: '#ebd5c0',
        color: '#000',
        backdrop: 'rgba(0,0,0,.6)'
      });
    }
    return;
  }

  const observacionSeleccionada = document.getElementById('observacion').value;
  const tiempoFalloInput = document.getElementById('tiempo-fallo');

  if (document.getElementById('observacion').value === 'Fallo de maquina') {
    const horaInicio = document.getElementById('horaInicio').value;
    const horaFinal = document.getElementById('horaFin').value;
    const tiempoFalloInput = document.getElementById('tiempo-fallo');
    const tiempoFalloMinutos = parseInt(tiempoFalloInput.value, 10);

    // Asegura que sea un número y mayor a cero.
    if (isNaN(tiempoFalloMinutos) || tiempoFalloMinutos <= 0) {

      Swal.fire({
        title: 'Tiempo de Fallo Inválido',
        text: 'El tiempo de fallo no debe estar vacío y debe ser un número mayor a cero.',
        icon: 'error',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#ed6b07',
        background: '#ebd5c0',
        color: '#000',
        iconColor: '#e11d48'
      });
      return; // Detiene el envío
    }

    // Validación del rango de tiempo (que ya tenías)
    if (!horaInicio || !horaFinal) {
      Swal.fire({
        title: 'Faltan Horas',
        text: 'Debes definir la hora inicial y final para poder validar el tiempo de fallo.',
        icon: 'error',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#ed6b07',
        background: '#ebd5c0',
        color: '#000',
        iconColor: '#e11d48'
      });
      return; // Detiene el envío
    }

    const fechaInicio = new Date(`1970-01-01T${horaInicio}`);
    const fechaFinal = new Date(`1970-01-01T${horaFinal}`);
    const rangoEnMinutos = (fechaFinal - fechaInicio) / 60000;

    if (tiempoFalloMinutos > rangoEnMinutos) {
      Swal.fire({
        title: 'Tiempo Excedido',
        text: `El tiempo de fallo (${tiempoFalloMinutos} min) no puede ser mayor que el rango total del turno (${rangoEnMinutos} min).`,
        icon: 'error',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#ed6b07',
        background: '#ebd5c0',
        color: '#000',
        iconColor: '#e11d48'
      });
      return; // Detiene el envío
    }
  }

  // Devuelve 'N/A' si el campo quedó marcado como N/A, si está vacío,
  // o si el option seleccionado está deshabilitado/placeholder.
  function getSelectTextNA(id) {
    const el = document.getElementById(id);
    if (!el) return 'N/A';
    if (el.dataset.naApplied === '1') return 'N/A';
    const opt = el.selectedOptions?.[0];
    const txt = (opt?.textContent || opt?.text || '').trim();
    if (!txt || opt?.disabled) return 'N/A';
    return txt;
  }

  // Para selects donde quieres el VALUE (no el texto visible)
  function getSelectValueNA(id) {
    const el = document.getElementById(id);
    if (!el) return 'N/A';
    if (el.dataset.naApplied === '1') return 'N/A';
    const val = (el.value || '').trim();
    if (!val) return 'N/A';
    // si el option seleccionado está deshabilitado, trátalo como N/A
    const opt = el.selectedOptions?.[0];
    if (opt?.disabled) return 'N/A';
    return val;
  }

  // Fechas / horas: devuelve el valor o "N/A" si está marcada como N/A
  function getDateNA(id) {
    const el = document.getElementById(id);
    if (!el) return "N/A";
    if (el.dataset.naApplied === "1") return "N/A";
    return (el.value || "").trim() || "N/A";
  }


  // Texto plano: devuelve "N/A" si quedó marcado, o si está vacío
  function getTextNA(id) {
    const el = document.getElementById(id);
    const s = (el?.value || '').trim();
    if (el?.dataset.naApplied === '1') return 'N/A';
    return s || 'N/A';
  }


  const input = {
    cc: (document.getElementById('id')?.value?.trim() || null), // el backend ya lo blinda
    nombres: getTextNA('nombre'),

    // Estos son selects (value)
    sede: getSelectTextNA('sede'),
    estado_sci: getSelectTextNA('estado-sci'),
    area: getSelectTextNA('ctpn'),
    horario: getSelectTextNA('horprog'),

    // Estos son inputs texto
    no_op: getTextNA('op'),
    sci_ref: getTextNA('sci'),
    descripcion_referencia: getTextNA('dr'),

    // Fechas/horas → NULL si están N/A
    fecha_inicio: getDateNA('fechaInicio'),
    hora_inicio: getDateNA('horaInicio'),
    fecha_final: getDateNA('fechaFin'),
    hora_final: getDateNA('horaFin'),

    // Estos quieren el TEXTO visible del option
    actividad: getSelectTextNA('actividad'),
    maquina: getSelectTextNA('maquina'),
    observaciones: getSelectTextNA('observacion'),

    observaciones: document.getElementById('observacion').value,
    tiempo_fallo_minutos: document.getElementById('observacion').value === 'Fallo de maquina'
      ? parseInt(document.getElementById('tiempo-fallo').value, 10)
      : 0,

    cantidad: (function () {
      const raw = document.getElementById('campo-cantidad')?.value?.trim() || '';
      if (!raw) return 0;
      const n = parseFloat(raw.replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    })(),
  };



  // feedback del botón (soporta botón creado dinámicamente)
  const btn = e?.target?.closest?.('#enviarFormulario') || document.getElementById('enviarFormulario');
  if (btn) { btn.disabled = true; btn.dataset._txt = btn.textContent; btn.textContent = 'Enviando...'; }

  try {
    const data = await gqlCall(MUTATION_CREAR, { input });
    // soporta forma de retorno de tu helper o del fetch
    const out = data?.crear_formulario || data?.data?.crear_formulario || data;

    // si tu resolver (por error) devolviera boolean, avisamos claro
    if (!out || typeof out !== 'object') {
      throw new Error('El servidor no retornó un objeto Formulario. Revisa que el resolver retorne la fila (RETURNING …), no "true".');
    }

    if (btn) { btn.disabled = false; btn.textContent = btn.dataset._txt || 'Enviar'; }

    if (btn) { btn.disabled = false; btn.textContent = btn.dataset._txt || 'Enviar'; }

    if (window.Swal) {
      const { isConfirmed } = await Swal.fire({
        title: '¡Registro guardado!',
        text: 'Tu información se ha enviado correctamente.',
        icon: 'success',
        confirmButtonText: 'Volver al inicio',
        confirmButtonColor: '#ed6b07',
        background: '#ebd5c0',
        color: '#000',
        iconColor: '#16a34a',
        allowOutsideClick: false,
        allowEscapeKey: false,
        toast: false,
        timer: undefined,
        heightAuto: false
      });

      if (isConfirmed) {
        window.location.reload(); // 👈 recarga SOLO tras pulsar el botón
        return; // opcional
      }
    }





  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset._txt || 'Enviar'; }
    console.error('crear_formulario error →', err);
    if (window.Swal) {
      Swal.fire({
        title: 'Ups, ocurrió un error',
        text: 'No fue posible enviar el formulario. Intenta de nuevo.',
        icon: 'error',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#ed6b07',
        background: '#ebd5c0',
        color: '#000',
        iconColor: '#e11d48'
      });
    }
  }
}

// ===== ENGANCHE SIN <form> (delegación, sirve si el botón aparece después) =====
document.addEventListener('click', (e) => {
  const target = e.target.closest('#enviarFormulario');
  if (!target) return;
  enviarFormulario(e);
});




// --- Helpers globales ---
const BASIC_ONLY_ACTIVITIES = new Set([
  'limpieza',
  'alimentacion',   // sin tilde para normalizar
  'reunion',
  'falla mecanica'
]);

const norm = (s) => (s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
  .toLowerCase().replace(/\s+/g, ' ').trim();

function selectedText(sel) {
  return sel?.options?.[sel.selectedIndex]?.textContent ?? '';
}

document.addEventListener('DOMContentLoaded', () => {
  // Refs
  const selActividad = document.getElementById('actividad');
  const vista2 = document.getElementById('vista2');
  const btnInfoBas = document.querySelector('.opcion-btn[data-page="1"]');
  const btnInfoDet = document.querySelector('.opcion-btn[data-page="2"]');
  const btnCalc = document.querySelector('.opcion-btn[data-page="3"]');
  const btnSubmit = document.getElementById('enviarFormulario');

  // --- Tu lógica de N/A se mantiene tal cual ---
  function setVista2NA(aplicar) {
    if (!vista2) return;
    const fields = vista2.querySelectorAll('input, select, textarea');

    fields.forEach(el => {
      if (aplicar) {
        if (el.dataset.prevValue === undefined) el.dataset.prevValue = el.value;

        if (el.tagName === 'SELECT') {
          let na = el.querySelector('option.auto-na-option');
          if (!na) {
            na = document.createElement('option');
            na.value = 'N/A';
            na.textContent = 'N/A';
            na.className = 'auto-na-option';
            el.appendChild(na);
          }
          el.value = 'N/A';
        } else {
          el.value = 'N/A';
        }
        el.dataset.naApplied = '1';
      } else {
        if (el.tagName === 'SELECT') {
          if (el.dataset.prevValue !== undefined) el.value = el.dataset.prevValue;
          el.querySelectorAll('option.auto-na-option').forEach(o => o.remove());
        } else {
          if (el.dataset.prevValue !== undefined) el.value = el.dataset.prevValue;
        }
        delete el.dataset.prevValue;
        delete el.dataset.naApplied;
      }
    });
  }

  function mostrarVista(n) {
    document.querySelectorAll('.vista').forEach(v => v.style.display = 'none');
    const target = document.getElementById(`vista${n}`);
    if (target) target.style.display = 'block';
    document.querySelectorAll('.opcion-btn').forEach(b => b.classList.remove('activo'));
    document.querySelector(`.opcion-btn[data-page="${n}"]`)?.classList.add('activo');
  }

  // --- Crear "slots" para mover el botón submit entre vistas ---
  function ensureSlot(viewId, slotId) {
    let slot = document.getElementById(slotId);
    if (!slot) {
      const view = document.getElementById(viewId);
      if (view) {
        slot = document.createElement('div');
        slot.id = slotId;
        slot.className = 'submit-slot';
        view.appendChild(slot);
      }
    }
    return slot;
  }
  const slotV1 = ensureSlot('vista1', 'submit-slot-v1');
  const slotV2 = ensureSlot('vista2', 'submit-slot-v2');

  function placeSubmitIn(viewNumber) {
    if (!btnSubmit) return;
    if (viewNumber === 2 && slotV2) {
      slotV2.appendChild(btnSubmit);
    } else if (slotV1) {
      slotV1.appendChild(btnSubmit);
    }
  }

  // --- REGLA CENTRAL: decidir por texto seleccionado ---
  function aplicarModoSegunActividad() {
    const txtSel = norm(selectedText(selActividad));
    const esBasico = BASIC_ONLY_ACTIVITIES.has(txtSel); // ← Limpieza/Alimentación/Reunión/Falla mecanica

    if (esBasico) {
      // Oculta la sección detallada (vista2) y su botón
      if (vista2) vista2.style.display = 'none';
      btnInfoDet?.classList.add('oculta');

      // Si estabas parado en vista2, vuelve a vista1
      if (btnInfoDet?.classList.contains('activo')) {
        mostrarVista(1);
      }

      // Aplica N/A a los campos de vista2
      setVista2NA(true);

      // Renombra "Calculadora" a "2. Calculadora"
      if (btnCalc) btnCalc.textContent = '2. Calculadora';

      // Mueve el botón submit a vista1
      placeSubmitIn(1);
    } else {
      // Muestra sección detallada y su botón
      if (vista2) vista2.style.display = '';
      btnInfoDet?.classList.remove('oculta');

      // Restaura valores originales de vista2
      setVista2NA(false);

      // Renombra a "3. Calculadora"
      if (btnCalc) btnCalc.textContent = '3. Calculadora';

      // Botón submit en vista2
      placeSubmitIn(2);
    }
  }

  // Hook de cambio en el select
  selActividad?.addEventListener('change', aplicarModoSegunActividad);

  // Estado inicial (por si ya hay una opción preseleccionada)
  aplicarModoSegunActividad();

  // Exponer para llamarlo después de poblar dinámicamente desde GraphQL
  window.aplicarModoSegunActividad = aplicarModoSegunActividad;
});


////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Encuentra el primer campo inválido (que no esté disabled) y lo retorna {el, cfg, idx}
function _primerInvalido() {
  for (let i = 0; i < CAMPOS.length; i++) {
    const c = CAMPOS[i];
    const el = document.getElementById(c.id);
    if (!el || el.disabled) continue; // ignora campos ausentes o deshabilitados por lógica externa
    if (_invalido(el, c)) return { el, cfg: c, idx: i };
  }
  return null;
}

// Quita estados visuales previamente aplicados
function _limpiarEstadosGUI() {
  document.querySelectorAll('.sugerido').forEach(n => n.classList.remove('sugerido'));
  document.querySelectorAll('.campo-bloqueado').forEach(w => {
    w.classList.remove('campo-bloqueado');
    w.removeAttribute('data-requires');
    const hint = w.querySelector('.bloqueo-hint');
    if (hint) hint.remove();
  });
}

// Aplica: permite hasta el primer inválido, resalta ese; bloquea el resto con hint
function actualizarBloqueoGUI({ autofocusSugerido = false } = {}) {
  _limpiarEstadosGUI();

  // 1) localiza primer inválido
  const pi = _primerInvalido();
  // si no hay inválidos: todo habilitado y sin bloqueos
  if (!pi) return;

  // 2) recorre en orden
  let yaCorte = false;
  for (let i = 0; i < CAMPOS.length; i++) {
    const c = CAMPOS[i];
    const el = document.getElementById(c.id);
    if (!el) continue;

    // si el campo fue marcado como "forzado" por otra lógica (p.ej., vista2 N/A), respétalo
    if (el.dataset.forceDisabled === '1') {
      el.disabled = true;
      continue;
    }

    if (!yaCorte && !_invalido(el, c)) {
      // válido → habilitado
      el.disabled = false;
    } else if (!yaCorte && _invalido(el, c)) {
      // este es el primer inválido → habilitado + sugerido
      el.disabled = false;
      el.classList.add('sugerido');
      if (autofocusSugerido) el.focus();
      yaCorte = true;
    } else {
      // lo que sigue al primer inválido → deshabilitado + mensaje
      el.disabled = true;
      const wrap = el.closest('div') || el.parentElement;
      if (wrap) {
        wrap.classList.add('campo-bloqueado');
        wrap.dataset.requires = pi.cfg.nombre || 'el campo anterior';
        // mensaje inline
        const msg = document.createElement('small');
        msg.className = 'bloqueo-hint';
        msg.textContent = `Completa ${wrap.dataset.requires} para continuar.`;
        // evita duplicados si re-renderiza
        if (!wrap.querySelector('.bloqueo-hint')) wrap.appendChild(msg);
      }
    }
  }
}

// Captura clicks en contenedores bloqueados para explicar y guiar
document.addEventListener('click', (e) => {
  const box = e.target.closest('.campo-bloqueado');
  if (!box) return;
  e.preventDefault();
  const needs = box.dataset.requires || 'el campo anterior';

  // Si tienes SweetAlert2 cargado:
  if (window.Swal) {
    Swal.fire({
      icon: 'info',
      title: 'Sigue el orden',
      text: `Completa ${needs} para habilitar este campo.`,
      confirmButtonColor: '#ed6b07',
      iconColor: '#e11d48',
      background: '#ebd5c0',
      color: '#000',
      backdrop: 'rgba(0,0,0,.6)',
    }).then(() => {
      const pi = _primerInvalido();
      pi?.el?.focus();
    });
  } else {
    // fallback nativo
    alert(`Completa ${needs} para habilitar este campo.`);
    const pi = _primerInvalido();
    pi?.el?.focus();
  }
});

// Engancha eventos para refrescar guiado en vivo
document.addEventListener('DOMContentLoaded', () => {
  // escucha cambios en todos los campos de CAMPOS
  CAMPOS.forEach(c => {
    const el = document.getElementById(c.id);
    if (!el) return;
    const evt = (c.tipo === 'select' || c.tipo === 'fecha' || c.tipo === 'hora') ? 'change' : 'input';
    el.addEventListener(evt, () => actualizarBloqueoGUI({ autofocusSugerido: false }));
  });

  // primer pintado
  actualizarBloqueoGUI({ autofocusSugerido: true });
});



(function () {

  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('intro');
    initIntroFlow();
  });

  function initIntroFlow() {
    const idsPersonal = ["id", "nombre", "actividad"];
    const cfgIndex = Object.fromEntries(CAMPOS.map(c => [c.id, c]));

    // Valida sólo los tres campos personales usando tu _invalido
    function personalValido(pintar) {
      let ok = true;
      idsPersonal.forEach(id => {
        const el = document.getElementById(id);
        const cfg = cfgIndex[id] || {};
        const inval = _invalido(el, cfg);
        if (pintar) {
          if (inval) showError(el, cfg.msg || 'Este campo es obligatorio.');
          else clearError(el);
        }
        if (inval) ok = false;
      });
      return ok;
    }

    // Sale del modo intro sin tocar vistas ni mover nodos
    function colapsarSidebar() {
      if (!document.body.classList.contains('intro')) return;
      if (!personalValido(false)) return;

      document.body.classList.remove('intro');     // vuelve a tu layout normal (sidebar + vistas)
      // Enfoca el primer campo de Información básica
      const first = document.querySelector('#vista1 select, #vista1 input, #vista1 textarea, #vista1 button');
      if (first) {
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        first.focus({ preventScroll: true });
      }
    }

    // Listeners en vivo: cuando el usuario complete los 3 primeros campos, colapsa
    const idEl = document.getElementById('id');
    const nomEl = document.getElementById('nombre');
    const actEl = document.getElementById('actividad');

    idEl?.addEventListener('input', () => { personalValido(true); colapsarSidebar(); });
    nomEl?.addEventListener('input', () => { personalValido(true); colapsarSidebar(); });
    actEl?.addEventListener('change', () => { personalValido(true); colapsarSidebar(); });

    // Pinta errores si se salen del campo sin completarlo
    [idEl, nomEl, actEl].forEach(el => el?.addEventListener('blur', () => personalValido(true)));
  }
})();


//---------------------------Lógica de filtrado ID-----------------------------------------------


const GQL_URL = '/graphql';

async function gql(query, variables) {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

//---------------------ID y NOMBRE-----------------------------------

// debounce
function debounce(fn, ms = 250) {
  let t;
  function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  }
  debounced.cancel = () => clearTimeout(t);
  return debounced;
}

let suppressSearch = false;

function programmaticFill(el, value) {
  if (!el) return;
  el.value = value ?? '';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function clearNombreAndRecalc($nombre) {
  programmaticFill($nombre, '');
  $nombre.readOnly = true;
  if (typeof bloquearCamposProgresivo === 'function') bloquearCamposProgresivo();
  if (typeof actualizarBloqueoGUI === 'function') actualizarBloqueoGUI();
}

document.addEventListener('DOMContentLoaded', () => {

  if (window.__ID_AUTOCOMPLETE_INIT__) return;
  window.__ID_AUTOCOMPLETE_INIT__ = true;

  const $id = document.getElementById('id');
  const $nombre = document.getElementById('nombre');
  const $box = document.getElementById('id-suggestions');

  function renderList(items) {
    $box.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'list';

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'Sin coincidencias';
      list.appendChild(empty);
    } else {
      items.forEach((it) => {
        const row = document.createElement('div');
        row.className = 'item';
        row.dataset.ident = it.identificacion;
        row.dataset.nombre = it.nombre;
        row.innerHTML = `<strong>${it.identificacion}</strong> — ${it.nombre}`;
        row.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          choose(it.identificacion, it.nombre);
        });
        list.appendChild(row);
      });
    }
    $box.appendChild(list);
  }

  function closeList() { $box.innerHTML = ''; }

  async function search(prefix) {
    if (!prefix) { closeList(); return; }
    try {
      const data = await gql(`
        query($prefix: String!, $limit: Int){
          buscarOperariosPorIdent(prefix: $prefix, limit: $limit) {
            identificacion
            nombre
          }
        }
      `, { prefix: String(prefix), limit: 8 });
      renderList(data.buscarOperariosPorIdent || []);
    } catch (e) {
      console.error(e);
      closeList();
    }
  }

  const debouncedSearch = debounce(search, 250);

  // === FIX: llenar como humano + recalcular gating ===
  function choose(ident, nombre) {
    // 1) Cancela cualquier búsqueda y limpia la lista
    debouncedSearch?.cancel?.();
    closeList();

    // 2) Identificación: asigna SIN disparar eventos
    $id.value = String(ident);

    // 3) Nombre: sí disparamos eventos para que quede “válido”
    if ($nombre.disabled) $nombre.disabled = false;
    $nombre.readOnly = true;
    $nombre.setCustomValidity && $nombre.setCustomValidity('');
    programmaticFill($nombre, nombre);

    // 4) Recalcula bloqueo/GUI para habilitar “actividad”
    if (typeof bloquearCamposProgresivo === 'function') bloquearCamposProgresivo();
    if (typeof actualizarBloqueoGUI === 'function') actualizarBloqueoGUI();

    // 5) Enfoca siguiente campo si ya está habilitado
    const next = document.getElementById('actividad');
    if (next && !next.disabled) next.focus();
  }


  // cuando cambie el input, buscar
  $id.addEventListener('input', (e) => {
    console.log('input id, suppress=', suppressSearch, 'value=', e.target.value);

    const v = String(e.target.value || '').replace(/\D+/g, '');
    e.target.value = v;

    if (!v) {
      debouncedSearch.cancel?.();   // ⬅️ cancela pendientes si borran todo
      programmaticFill($nombre, '');
      $nombre.readOnly = true;
      if (typeof bloquearCamposProgresivo === 'function') bloquearCamposProgresivo();
      if (typeof actualizarBloqueoGUI === 'function') actualizarBloqueoGUI();
      closeList();
      return;
    }

    debouncedSearch(v);
  });


  // al perder foco, si hay un número, intentamos resolver exacto
  $id.addEventListener('blur', async () => {
    debouncedSearch.cancel?.();
    closeList();

    const v = String($id.value || '').trim();
    if (!v) {
      programmaticFill($nombre, '');
      $nombre.readOnly = true;
      if (typeof bloquearCamposProgresivo === 'function') bloquearCamposProgresivo();
      if (typeof actualizarBloqueoGUI === 'function') actualizarBloqueoGUI();
      return;
    }

    try {
      const data = await gql(`
        query($ident: ID!) {
          operarioPorIdent(ident: $ident) {
            identificacion
            nombre
          }
        }
      `, { ident: v });

      if (data && data.operarioPorIdent) {
        choose(data.operarioPorIdent.identificacion, data.operarioPorIdent.nombre);
      } else {
        programmaticFill($nombre, '');
        $nombre.readOnly = true;
        if (typeof bloquearCamposProgresivo === 'function') bloquearCamposProgresivo();
        if (typeof actualizarBloqueoGUI === 'function') actualizarBloqueoGUI();
      }
    } catch (e) {
      console.error('operarioPorIdent error →', e);
      programmaticFill($nombre, '');
      $nombre.readOnly = true;
      if (typeof bloquearCamposProgresivo === 'function') bloquearCamposProgresivo();
      if (typeof actualizarBloqueoGUI === 'function') actualizarBloqueoGUI();
    }
  });

  // navegación con teclado en el dropdown
  $id.addEventListener('keydown', (e) => {
    const list = $box.querySelector('.list');
    if (!list) return;
    const items = Array.from(list.querySelectorAll('.item'));
    if (!items.length) return;

    const idx = items.findIndex(n => n.classList.contains('active'));
    let next = idx;

    if (e.key === 'ArrowDown') {
      next = idx < items.length - 1 ? idx + 1 : 0;
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      next = idx > 0 ? idx - 1 : items.length - 1;
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (idx >= 0) {
        e.preventDefault();
        const it = items[idx];
        choose(it.dataset.ident, it.dataset.nombre);
      }
    } else if (e.key === 'Escape') {
      closeList();
    }
    items.forEach(n => n.classList.remove('active'));
    if (next >= 0 && items[next]) items[next].classList.add('active');
  });
});


//---------------------ACTIVIDAD-----------------------------------

async function cargarActividades() {
  const data = await gql(`
                            query {
                            actividades { id actividad }
                            }
                        `);

  const sel = document.getElementById('actividad');
  sel.innerHTML = '<option value="">Seleccione una actividad</option>';
  data.actividades.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;              // guardas el ID
    opt.textContent = a.actividad; // muestras el nombre
    sel.appendChild(opt);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  cargarActividades().catch(err => alert('Error: ' + err.message));
});


//---------------------OBSERVACIONES-----------------------------------

async function cargarObservaciones() {



  const sel = document.getElementById('observacion');

  const query = (`
                      query {
                      observaciones { id observaciones }
                      }
                  `);
  try {
    const data = await gql(query);
    sel.innerHTML = '<option value="">Seleccione una observación</option>';

    data.observaciones.forEach(a => {
      const opt = document.createElement('option');

      opt.value = a.observaciones;
      opt.textContent = a.observaciones;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error("Error al cargar observaciones:", err);
    sel.innerHTML = '<option value="">Error al cargar</option>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  cargarObservaciones().catch(err => alert('Error: ' + err.message));
});


//---------------------CTPN & MAQUINAS-----------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const $ctpn = document.getElementById('ctpn');
  const $maquina = document.getElementById('maquina');

  async function cargarCtpn() {
    // placeholder de carga
    $ctpn.innerHTML = `<option value="" disabled selected>Cargando CTPN...</option>`;
    try {
      const data = await gql(`
        query { ctpnList }
      `);

      const lista = data?.ctpnList || [];
      $ctpn.innerHTML = `<option value="" disabled selected>CT Pn</option>`;
      lista.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;          // usar el ct_pn literal como value
        opt.textContent = v;
        $ctpn.appendChild(opt);
      });

      // habilita ctpn
      $ctpn.disabled = false;

      // si tienes bloqueo progresivo, recalcúlalo
      if (typeof bloquearCamposProgresivo === 'function') bloquearCamposProgresivo();
      if (typeof actualizarBloqueoGUI === 'function') actualizarBloqueoGUI();

    } catch (err) {
      console.error('Error cargando CTPN:', err);
      $ctpn.innerHTML = `<option value="" disabled selected>Error cargando CTPN</option>`;
    }
  }

  async function cargarMaquinasPara(ctpn) {
    // UI mientras carga
    $maquina.innerHTML = `<option value="" disabled selected>Cargando máquinas...</option>`;
    $maquina.disabled = true;

    try {
      const data = await gql(`
        query($ctpn: String!) {
          maquinasPorCtpn(ctpn: $ctpn) { id ct_pn maquina }
        }
      `, { ctpn });

      const items = data?.maquinasPorCtpn || [];
      $maquina.innerHTML = `<option value="" disabled selected>Seleccione una máquina</option>`;
      items.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;           // guarda el id
        opt.textContent = m.maquina;
        opt.dataset.ctpn = m.ct_pn; // (opcional) por si necesitas saber el ct_pn luego
        $maquina.appendChild(opt);
      });

      // habilita el select de máquinas si hay data
      $maquina.disabled = items.length === 0;

      // dispara eventos para tu gating si hace falta
      programmaticFill($maquina, ''); // deja sin selección inicial (placeholder)
      if (typeof bloquearCamposProgresivo === 'function') bloquearCamposProgresivo();
      if (typeof actualizarBloqueoGUI === 'function') actualizarBloqueoGUI();

    } catch (err) {
      console.error('Error cargando máquinas:', err);
      $maquina.innerHTML = `<option value="" disabled selected>Error cargando máquinas</option>`;
      $maquina.disabled = true;
    }
  }

  // Cuando cambie el CTPN → carga máquinas relacionadas
  $ctpn.addEventListener('change', (e) => {
    const val = e.target.value || '';
    // limpia selección previa de máquina
    programmaticFill($maquina, '');
    $maquina.disabled = true;
    $maquina.innerHTML = `<option value="" disabled selected>Cargando máquinas...</option>`;

    if (val) cargarMaquinasPara(val);
  });

  // Carga inicial
  cargarCtpn().catch(err => alert('Error: ' + err.message));
});

//------------------------CONTROL OP-------------------------------------------------------------

// ====== OP (input) → SCI (select) → DR (autocompletado) ======
(function () {
  const $op = document.getElementById('op');   // input No OP
  const $sci = document.getElementById('sci');  // SELECT SCI Ref
  const $dr = document.getElementById('dr');   // input Descripción Referencia
  if (!$op || !$sci || !$dr) return;

  // DR solo lectura; SCI deshabilitado hasta que haya OP válido
  $dr.readOnly = true;
  $sci.disabled = true;

  // ===== helpers =====
  function ensureBox(id, afterEl) {
    let box = document.getElementById(id);
    if (!box) {
      box = document.createElement('div');
      box.id = id;
      box.className = 'suggestions';
      afterEl.insertAdjacentElement('afterend', box);
    }
    return box;
  }
  const $opBox = ensureBox('op-suggestions', $op);

  function closeList(box) { if (box) box.innerHTML = ''; }
  function closeAll() { closeList($opBox); }

  function markOpValid(ok) {
    $op.dataset.valid = ok ? '1' : '0';
    $op.classList.toggle('invalid', !ok);
  }
  markOpValid(false); // arranca inválido hasta que elijan uno válido

  // Rellena sin disparar validaciones “como tipeo humano” pero sí refresca bloqueo


  function programmaticFill(el, value, { silent = false } = {}) {
    if (!el) return;
    el.value = value ?? '';
    if (!silent) {
      const ev = (el.tagName === 'SELECT') ? 'change' : 'input';
      el.dispatchEvent(new Event(ev, { bubbles: true }));
    }
    if (typeof bloquearCamposProgresivo === 'function') bloquearCamposProgresivo();
    if (typeof actualizarBloqueoGUI === 'function') actualizarBloqueoGUI();
  }


  // --- cuando el usuario ESCRIBE en OP, lo invalidamos y reseteamos dependientes ---
  let suppressOpSearch = false;

  $op.addEventListener('input', (e) => {
    if (suppressOpSearch) {         // ← evita re-buscar tras elegir
      suppressOpSearch = false;
      return;
    }
    const v = String(e.target.value || '').trim();
    if (!v) {
      // limpia dependientes y cierra
      programmaticFill($sci, '', { silent: true });
      programmaticFill($dr, '', { silent: true });
      closeAll && closeAll();
      return;
    }
    debouncedOP(v);
  });


  // --- valida OP en blur, por si escribieron exacto sin elegir de la lista ---
  async function validarOPPorServidor() {
    const op = String($op.value || '').trim();
    if (!op) { markOpValid(false); return; }

    try {
      const data = await gql(`
        query($op:String!){ buscarSciPorOp(op:$op, limit:1) }`,
        { op }
      );
      const existe = Array.isArray(data?.buscarSciPorOp) && data.buscarSciPorOp.length > 0;
      markOpValid(existe);

      if (!existe) {
        // feedback amable (puedes cambiar por tu showError o Swal)
        console.warn('OP inválido: no existe en Excel');
        // opcional: enfocar y seleccionar para corregir
        setTimeout(() => { $op.focus(); $op.select?.(); }, 0);
      }
    } catch (e) {
      console.error('validarOPPorServidor error →', e);
      markOpValid(false);
    }
  }
  $op.addEventListener('blur', validarOPPorServidor);

  // --- ganchos donde ya tengas chooseOP (DEBES marcar válido ahí) ---
  // Si en tu código ya existe window.chooseOP, sobreescríbela o asegúrate de llamar markOpValid(true)
  window.chooseOP = function (op) {
    programmaticFill($op, op);
    markOpValid(true);             // ← MUY IMPORTANTE
    // aquí tu lógica actual para cargar SCI:
    // cargarSciParaOp(op); $sci.focus();
    if (typeof cargarSciParaOp === 'function') cargarSciParaOp(op);
    $sci?.focus();
  };

  // --- bloqueo en el SUBMIT (o en tu botón) ---
  // Si usas un <form id="miFormulario">:
  const form = document.getElementById('miFormulario');
  if (form) {
    form.addEventListener('submit', (e) => {
      if ($op.dataset.valid !== '1') {
        e.preventDefault();
        // usa tu SweetAlert si quieres:
        if (window.Swal) {
          Swal.fire({ icon: 'error', title: 'OP inválido', text: 'Selecciona un OP válido de la lista.' });
        }
        $op.focus();
      }
    });
  }

  // Si usas un botón #enviarFormulario sin <form>, protégelo también:
  const btn = document.getElementById('enviarFormulario');
  if (btn) {
    btn.addEventListener('click', (e) => {
      if ($op.dataset.valid !== '1') {
        e.preventDefault();
        if (window.Swal) {
          Swal.fire({ icon: 'error', title: 'OP inválido', text: 'Selecciona un OP válido de la lista.' });
        }
        $op.focus();
      }
    });
  }

  function renderListSimple(box, items) {
    box.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'sugg-list';

    if (!items || !items.length) {
      const empty = document.createElement('div');
      empty.className = 'sugg-muted';
      empty.textContent = 'Sin coincidencias';
      list.appendChild(empty);
    } else {
      items.forEach((str) => {
        const row = document.createElement('div');
        row.className = 'sugg-item';
        row.textContent = str;

        // 👇 pointerdown evita perder foco y asegura que se ejecute antes del blur
        row.addEventListener('pointerdown', (ev) => {
          ev.preventDefault();
          chooseOP(str);   // <-- ¡aquí pasas el valor correcto!
        }, { passive: false });

        // fallback si no hay pointer events
        row.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          chooseOP(str);
        }, { passive: false });

        list.appendChild(row);
      });
    }

    box.appendChild(list);
  }



  function option(value, text, disabled = false, selected = false) {
    const o = document.createElement('option');
    o.value = value; o.textContent = text;
    if (disabled) o.disabled = true;
    if (selected) o.selected = true;
    return o;
  }

  function debounce(fn, ms = 250) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // ====== buscar OP (con sugerencias) ======
  async function searchOP(prefix) {
    if (!prefix) { closeAll(); return; }
    try {
      const data = await gql(`
        query($prefix:String!, $limit:Int){
          buscarOpsExcel(prefix:$prefix, limit:$limit)
        }`, { prefix: String(prefix), limit: 8 }
      );
      renderListSimple($opBox, data.buscarOpsExcel || [], (chosenOP) => {
        chooseOP(chosenOP);
      });
    } catch (e) {
      console.error('buscarOpsExcel error →', e);
      closeAll();
    }
  }
  const debouncedOP = debounce(searchOP, 250);

  // Al tipear en OP
  $op.addEventListener('input', (e) => {
    if (suppressOpSearch) { // evita re-búsqueda tras elegir
      suppressOpSearch = false;
      return;
    }
    const v = String(e.target.value || '').trim();
    if (!v) {
      programmaticFill($sci, '', { silent: true });
      programmaticFill($dr, '', { silent: true });
      closeAll && closeAll();
      return;
    }
    debouncedOP(v);
  });


  // Cierra sugerencias un ratito después del blur
  $op.addEventListener('blur', () => { setTimeout(closeAll, 150); });

  // Navegación con teclado en la lista de OP
  $op.addEventListener('keydown', (e) => {
    const list = $opBox.querySelector('.list');
    if (!list) return;
    const items = Array.from(list.querySelectorAll('.item'));
    if (!items.length) return;
    const idx = items.findIndex(n => n.classList.contains('active'));
    let next = idx;

    if (e.key === 'ArrowDown') { next = idx < items.length - 1 ? idx + 1 : 0; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { next = idx > 0 ? idx - 1 : items.length - 1; e.preventDefault(); }
    else if (e.key === 'Enter') {
      if (idx >= 0) {
        e.preventDefault();
        items[idx].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      }
    } else if (e.key === 'Escape') {
      closeAll();
    }
    items.forEach(n => n.classList.remove('active'));
    if (next >= 0 && items[next]) items[next].classList.add('active');
  });

  // ====== cargar SCI (select) según OP ======
  async function cargarSciParaOp(op) {
    // reset de SCI y DR
    $sci.innerHTML = '';
    $sci.appendChild(option('', 'Seleccione SCI', true, true));
    $sci.disabled = true;
    programmaticFill($dr, '');
    const v = String(op || '').trim();
    if (!v) return;

    try {
      const data = await gql(`
        query($op:String!, $limit:Int){
          buscarSciPorOp(op:$op, limit:$limit)
        }`, { op: v, limit: 200 }
      );
      const lista = data?.buscarSciPorOp || [];
      if (lista.length) {
        lista.forEach(s => $sci.appendChild(option(s, s)));
        $sci.disabled = false;
        // si quieres autoseleccionar cuando solo hay 1:
        // if (lista.length === 1) { programmaticFill($sci, lista[0]); $sci.dispatchEvent(new Event('change', {bubbles:true})); }
      }
    } catch (e) {
      console.error('buscarSciPorOp error →', e);
    } finally {
      if (typeof bloquearCamposProgresivo === 'function') bloquearCamposProgresivo();
      if (typeof actualizarBloqueoGUI === 'function') actualizarBloqueoGUI();
    }
  }

  // ====== autocompletar DR al elegir SCI ======
  async function resolverDR(op, sci) {
    programmaticFill($dr, '');
    const _op = String(op || '').trim();
    const _sci = String(sci || '').trim();
    if (!_op || !_sci) return;
    try {
      const res = await gql(`
        query($op:String!, $sci:String!){
          refPorOpSci(op:$op, sci:$sci){ descripcion }
        }`, { op: _op, sci: _sci }
      );
      const desc = res?.refPorOpSci?.descripcion || '';
      programmaticFill($dr, desc);
    } catch (e) {
      console.error('refPorOpSci error →', e);
    }
  }

  // ====== selección programática de OP (la usa la lista de sugerencias) ======
  // llamada al elegir una sugerencia
  function chooseOP(op) {
    // cierra primero para que no se vuelva a pintar
    closeAll && closeAll();

    // evita que el listener de input vuelva a buscar
    suppressOpSearch = true;

    // rellena en silencio
    programmaticFill($op, op, { silent: true });

    // marca válido
    $op.dataset.valid = '1';
    $op.classList.remove('invalid');

    // resetea dependencias y enfoca SCI (ajusta a tu caso: select vs input)
    if ($sci.tagName === 'SELECT') {
      $sci.disabled = false;
      // cargarOpcionesSci(op); // si tienes una función para cargar opciones por OP
      $sci.focus();
    } else {
      programmaticFill($sci, '', { silent: true });
      programmaticFill($dr, '', { silent: true });
      $dr.readOnly = true;
      $sci.focus();
    }
  }
  // expón por si otra lógica quiere llamarla
  window.chooseOP = chooseOP;

  // Si el usuario escribe OP exacto y hace blur, intenta cargar lista de SCI
  $op.addEventListener('blur', () => {
    const v = String($op.value || '').trim();
    if (v) cargarSciParaOp(v);
  });

  // Al cambiar el select de SCI, resolver DR
  $sci.addEventListener('change', () => {
    const op = String($op.value || '').trim();
    const sci = String($sci.value || '').trim();
    resolverDR(op, sci);
  });
})();

// ----------------------------- TIEMPO FALLO DE MAQUINA -----------------------------

function gestionarVisibilidadFalloMaquina() {
  const selectObservacion = document.getElementById('observacion');
  const contenedorTiempoFalla = document.getElementById('fallo-maquina-container');
  const inputTiempoFalla = document.getElementById('tiempo-fallo');

  if (!selectObservacion || !contenedorTiempoFalla || !inputTiempoFalla) {
    return;
  }

  const esFalloMaquina = selectObservacion.value === 'Fallo de maquina';

  contenedorTiempoFalla.classList.toggle('oculto', !esFalloMaquina);
  inputTiempoFalla.required = esFalloMaquina;

  if (!esFalloMaquina) {
    inputTiempoFalla.value = '';
  }
}

async function inicializarLogicaObservaciones() {
  // 1. Esperamos a que las opciones del select se carguen desde la base de datos.
  await cargarObservaciones();

  // 2. Una vez cargadas, buscamos el select y le añadimos el event listener.
  const selectObservacion = document.getElementById('observacion');
  if (selectObservacion) {
    // Llama a la función una vez al inicio para establecer el estado correcto.
    gestionarVisibilidadFalloMaquina();
    // Y luego la llama cada vez que el usuario cambie la opción.
    selectObservacion.addEventListener('change', gestionarVisibilidadFalloMaquina);
  }
}

// Punto de entrada: Llama a la función de inicialización cuando el DOM esté listo.
document.addEventListener('DOMContentLoaded', inicializarLogicaObservaciones);