const GQL = '/graphql';

// AbortController para cancelar la petición anterior si el usuario sigue tecleando
let currentAbort;

// REGISTRO DE CAMBIOS PENDIENTES
let pendingChanges = {};

const token = localStorage.getItem('authToken');

if (!token) {
  // Si no hay token, no está autorizado. Lo devolvemos al login.
  alert("Acceso no autorizado. Por favor, inicie sesión.");
  window.location.href = '/login';
}

// ----------- Validación de fecha y hora -----------------

/**
 * Valida el rango completo de fecha/hora de una fila.
 * Marca las celdas con error si la validación falla.
 * @param {HTMLTableRowElement} tr - La fila <tr> que se está validando.
 * @param {string} campoActual - El 'data-field' del campo que se acaba de editar.
 * @param {string} valorNuevo - El nuevo valor para el campo que se acaba de editar.
 * @returns {boolean} - 'true' si es válido, 'false' si no.
 */
function validarRangoFechaHora(tr, campoActual, valorNuevo) {
  // 1. Referencias a las 4 celdas de fecha/hora
  const tdFi = tr.querySelector('td[data-field="fecha_inicio"]');
  const tdHi = tr.querySelector('td[data-field="hora_inicio"]');
  const tdFf = tr.querySelector('td[data-field="fecha_final"]');
  const tdHf = tr.querySelector('td[data-field="hora_final"]');

  // Limpia errores previos en las 4 celdas
  [tdFi, tdHi, tdFf, tdHf].forEach(td => td.classList.remove('error'));

  // 2. Obtiene los 4 valores, usando el valor nuevo para el campo que se está editando
  const fi = campoActual === 'fecha_inicio' ? valorNuevo : tdFi.textContent.trim();
  const hi = campoActual === 'hora_inicio' ? valorNuevo : tdHi.textContent.trim();
  const ff = campoActual === 'fecha_final' ? valorNuevo : tdFf.textContent.trim();
  const hf = campoActual === 'hora_final' ? valorNuevo : tdHf.textContent.trim();

  // Si falta algún dato, la validación pasa por ahora (se validará el no-vacío en otra parte)
  if (!fi || !hi || !ff || !hf) return true;

  // 3. Crea los objetos Date para comparar
  const start = new Date(`${fi}T${hi}`);
  const end = new Date(`${ff}T${hf}`);

  // 4. Ejecuta las validaciones
  if (end <= start) {
    console.error('Validation Error: La fecha final debe ser mayor que la inicial.');
    tdFf.classList.add('error');
    tdHf.classList.add('error');
    return false; // No es válido
  }

  const diffHoras = (end - start) / 3600000; // 36e5 es 3600000
  if (diffHoras > 14) {
    console.error('Validation Error: El rango no puede superar las 14 horas.');
    tdFf.classList.add('error');
    tdHf.classList.add('error');
    return false; // No es válido
  }

  // 5. Si todo está bien, devuelve true
  return true;
}

// --------------------------------------------------------

async function gql(query, variables = {}) {
  if (currentAbort) currentAbort.abort();
  currentAbort = new AbortController();

  const r = await fetch(GQL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: currentAbort.signal
  });

  const j = await r.json().catch(async () => {
    const txt = await r.text();
    console.error('Respuesta no-JSON:', txt);
    throw new Error('Respuesta no-JSON del servidor');
  });
  if (j.errors) {
    console.error('GraphQL errors:', j.errors);
    throw new Error(j.errors.map(e => e.message).join(' | '));
  }
  return j.data;
}

// Estado de paginación
let pageSize = 20;
let offset = 0;
let total = 0;

// estado global de filtros
let dateFrom = '';
let dateTo = '';

const lista = document.getElementById('lista');
const info = document.getElementById('pageInfo');
const btnPrev = document.getElementById('prev');
const btnNext = document.getElementById('next');
const selPageSize = document.getElementById('pageSize');
const inputQ = document.getElementById('q');
const btnClear = document.getElementById('limpiarfiltros');
const pickerEl = document.getElementById('datepicker');
const inputId = document.getElementById('filterById');
const inputNoOp = document.getElementById('filterByNoOp');
const btnGuardar = document.getElementById('btnGuardar');
const saveStatus = document.getElementById('saveStatus');
const SelectSedes = document.getElementById('filtroSede');

function updateSaveButtonState() {
  const hasChanges = Object.keys(pendingChanges).length > 0;
  if (hasChanges) {
    btnGuardar.disabled = false;
    saveStatus.textContent = `🟠 ${Object.keys(pendingChanges).length} columna(s) editadas sin guardar`;
    saveStatus.dataset.status = 'unsaved';
  } else {
    btnGuardar.disabled = true;
    saveStatus.textContent = '✅ Guardado';
    saveStatus.dataset.status = 'saved';
  }
}
// -----------------------------------------------------------------------

/**
 * Gestiona la lógica de habilitar/deshabilitar campos basados en la actividad seleccionada.
 * @param {HTMLSelectElement} selectActividad - El elemento <select> del campo 'actividad'.
 */
function handleActividadChange(selectActividad) {
  const tr = selectActividad.closest('tr');
  if (!tr) return;

  const id = tr.dataset.id;
  const actividadSeleccionada = selectActividad.value;

  // Lista de actividades que deshabilitan otros campos
  const actividadesNoProductivas = [
    "Alimentación",
    "Limpieza",
    "Reunion",
    "Falla mecanica"
  ];

  const esActividadNoProductiva = actividadesNoProductivas.includes(actividadSeleccionada);

  // --- Referencias a las CELDAS (TD) que contienen los inputs/selects ---
  const celdas = {
    no_op: tr.querySelector('td[data-field="no_op"]'),
    sci_ref: tr.querySelector('td[data-field="sci_ref"]'),
    descripcion_referencia: tr.querySelector('td[data-field="descripcion_referencia"]'),
    estado_sci: tr.querySelector('td[data-field="estado_sci"]'),
    cantidad: tr.querySelector('td[data-field="cantidad"]'),
    area: tr.querySelector('td[data-field="area"]'),
    maquina: tr.querySelector('td[data-field="maquina"]'),
    horario: tr.querySelector('td[data-field="horario"]'),
    observaciones: tr.querySelector('td[data-field="observaciones"]'),
    tiempo_fallo_minutos: tr.querySelector('td[data-field="tiempo_fallo_minutos"]')
  };

  if (esActividadNoProductiva) {
    // ---- LÓGICA PARA DESHABILITAR CAMPOS ----

    // Campos de texto se vuelven 'N/A' y read-only
    if (celdas.no_op) { celdas.no_op.textContent = 'N/A'; celdas.no_op.classList.add('ro'); trackChange(id, 'no_op', 'N/A'); }
    if (celdas.sci_ref) { celdas.sci_ref.textContent = 'N/A'; celdas.sci_ref.classList.add('ro'); trackChange(id, 'sci_ref', 'N/A'); }
    if (celdas.descripcion_referencia) { celdas.descripcion_referencia.textContent = 'N/A'; trackChange(id, 'descripcion_referencia', 'N/A'); }
    if (celdas.area) { celdas.area.textContent = 'N/A'; celdas.area.classList.add('ro'); trackChange(id, 'area', 'N/A'); }
    if (celdas.maquina) { celdas.maquina.textContent = 'N/A'; celdas.maquina.classList.add('ro'); trackChange(id, 'maquina', 'N/A'); }

    // Cantidad se vuelve 0 y read-only
    if (celdas.cantidad) { celdas.cantidad.textContent = '0'; celdas.cantidad.classList.add('ro'); trackChange(id, 'cantidad', 0); }

    // Selects se RE-RENDERIZAN como deshabilitados con 'N/A'
    if (celdas.estado_sci) { celdas.estado_sci.innerHTML = renderEstadoSelect('N/A'); trackChange(id, 'estado_sci', 'N/A'); }
    if (celdas.horario) { celdas.horario.innerHTML = renderHorarioSelect('N/A'); trackChange(id, 'horario', 'N/A'); }
    if (celdas.observaciones) {
      const obsValor = actividadSeleccionada === "Falla mecanica" ? "Fallo de maquina" : "N/A";
      celdas.observaciones.innerHTML = renderObservacionSelect(obsValor);
      const nuevoSelect = celdas.observaciones.querySelector('select');
      if (nuevoSelect) {
        nuevoSelect.disabled = true;
        trackChange(id, 'observaciones', nuevoSelect.value);
      }
    }

    if (celdas.tiempo_fallo_minutos) {
      if (actividadSeleccionada === "Falla mecanica") {
        // Si la actividad es Falla Mecánica, HABILITAMOS el campo
        celdas.tiempo_fallo_minutos.classList.remove('ro');
        if (celdas.tiempo_fallo_minutos.textContent === '0') {
          celdas.tiempo_fallo_minutos.textContent = '';
        }
      } else {
        // Para OTRAS actividades básicas (Limpieza, etc.), lo DESHABILITAMOS
        celdas.tiempo_fallo_minutos.textContent = '0';
        celdas.tiempo_fallo_minutos.classList.add('ro');
        trackChange(id, 'tiempo_fallo_minutos', 0);
      }
    }

  } else { // <-- ESTE ES EL BLOQUE QUE SE MODIFICA

    // 1. Restaurar campos que SÍ se vuelven editables
    ['no_op', 'sci_ref', 'area', 'maquina', 'cantidad'].forEach(field => {
      const celda = celdas[field];
      if (celda) {
        const valorOriginal = celda.dataset.originalValue;
        celda.textContent = valorOriginal;
        celda.classList.remove('ro'); // <-- Se habilita la edición
        trackChange(id, field, field === 'cantidad' ? Number(valorOriginal) : valorOriginal);
      }
    });

    // 2. Restaurar 'descripcion_referencia' pero MANTENERLO como solo lectura
    const celdaDesc = celdas['descripcion_referencia'];
    if (celdaDesc) {
      const valorOriginal = celdaDesc.dataset.originalValue;
      celdaDesc.textContent = valorOriginal;
      trackChange(id, 'descripcion_referencia', valorOriginal);
    }

    // 3. Restaurar los selects (esto se queda igual que antes)
    if (celdas.estado_sci) {
      const valorOriginal = celdas.estado_sci.dataset.originalValue;
      celdas.estado_sci.innerHTML = renderEstadoSelect(valorOriginal);
      trackChange(id, 'estado_sci', celdas.estado_sci.querySelector('select').value);
    }
    if (celdas.horario) {
      const valorOriginal = celdas.horario.dataset.originalValue;
      celdas.horario.innerHTML = renderHorarioSelect(valorOriginal);
      trackChange(id, 'horario', celdas.horario.querySelector('select').value);
    }
    if (celdas.observaciones) {
      const valorOriginal = celdas.observaciones.dataset.originalValue;
      celdas.observaciones.innerHTML = renderObservacionSelect(valorOriginal);
      trackChange(id, 'observaciones', celdas.observaciones.querySelector('select').value);
    }

    // --- ✅ LÓGICA AÑADIDA ---
    // Restablece el campo de tiempo de fallo a 0 y lo deshabilita.
    if (celdas.tiempo_fallo_minutos) {
      celdas.tiempo_fallo_minutos.textContent = '0';
      celdas.tiempo_fallo_minutos.classList.add('ro');
      trackChange(id, 'tiempo_fallo_minutos', 0);
    }
  }
}

/**
 * Se ejecuta cuando cambia una observación en la tabla.
 * Habilita/deshabilita y limpia la celda de tiempo de fallo según la selección.
 * @param {HTMLSelectElement} selectObservacion - El <select> que acaba de cambiar.
 */
function handleObservacionChange(selectObservacion) {
  const tr = selectObservacion.closest('tr');
  if (!tr) return;

  const id = tr.dataset.id;
  const celdaTiempoFallo = tr.querySelector('td[data-field="tiempo_fallo_minutos"]');
  if (!celdaTiempoFallo) return;

  // Comprobamos si la nueva observación es "Fallo de maquina"
  const esFalloMaquina = selectObservacion.value === 'Fallo de maquina';

  if (esFalloMaquina) {
    // Si es "Fallo de maquina", hacemos la celda editable
    celdaTiempoFallo.classList.remove('ro');
  } else {
    // Si es cualquier otra cosa, la bloqueamos, ponemos '0' y guardamos el cambio
    celdaTiempoFallo.classList.add('ro');
    celdaTiempoFallo.textContent = '0';
    trackChange(id, 'tiempo_fallo_minutos', 0); // Registra el cambio a 0
  }
}



lista.addEventListener('change', (e) => {
  const sel = e.target.closest('select[data-field]');
  if (!sel) return;

  const tr = sel.closest('tr');
  if (!tr) return;

  const id = tr.dataset.id;
  const field = sel.dataset.field;
  const val = sel.value;

  if (!id) {
    return console.error("No se pudo encontrar el 'id' de la fila para el select.");
  }

  // Registra el cambio del campo actual
  trackChange(id, field, val);

  // Si el campo que cambió fue 'actividad', ejecuta la lógica de habilitar/deshabilitar
  if (field === 'actividad') {
    handleActividadChange(sel);
  }
  if (field === 'observaciones') {
    handleObservacionChange(sel);
  }

});

// ------------------------------------------------------------------------

function trackChange(id, field, value) {
  if (!pendingChanges[id]) {
    pendingChanges[id] = {};
  }
  pendingChanges[id][field] = value;
  updateSaveButtonState();
}

// Normalizar textos provenientes de la base de datos
function normText(s) {
  if (!s) return '';
  return s.toString()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '') // quita acentos
    .replace(/_/g, ' ')                              // guion_bajo → espacio
    .replace(/\s+/g, ' ')                            // colapsa espacios
    .trim()
    .toLowerCase();
}

// ------------------Sede Select-----------------------------------------

// Canonizamos valores/labels para guardar
const SEDE_A = { value: 'Colombia-Antioquia-Sabaneta-SEDE-PX-1', label: 'Colombia-Antioquia-Sabaneta-SEDE-PX-1' };
const SEDE_B = { value: 'Colombia-Antioquia-La Estrella-SEDE-PX-1', label: 'Colombia-Antioquia-La Estrella-SEDE-PX-1' };

// función util para pintar el select con la opción opuesta
function renderSedeSelect(valorBD) {

  const n = normText(valorBD);

  const isSabaneta = n.includes('sabaneta');
  const isLaEstrella = n.includes('la estrella') || n.includes('estrella');

  /// Armamos SIEMPRE ambas opciones; marcamos selected según lo detectado
  const optA = `<option value="${SEDE_A.value}" ${isSabaneta ? 'selected' : ''}>${SEDE_A.label}</option>`;
  const optB = `<option value="${SEDE_B.value}" ${isLaEstrella ? 'selected' : ''}>${SEDE_B.label}</option>`;

  // Si no reconoce ninguna, no marcamos selected (el usuario elegirá)
  return `
    <select class="sede-select" data-field="sede">
      ${optA}
      ${optB}
    </select>
  `;
}

// ------------------Actividad Select--------------------------------------

const ACTIVIDADES = [
  "Corte",
  "Descolille",
  "Embobinado",
  "Empaque",
  "Impresion",
  "Plastificado",
  "Formacion de Vasos",
  "Troquelado",
  "Impresión Zebra",
  "Alimentación",
  "Limpieza",
  "Reunion",
  "Falla mecanica"
];

function renderActividadSelect(valorBD) {
  const n = normText(valorBD);

  // detecta si el valor está en la lista canónica
  const current = ACTIVIDADES.find(act => normText(act) === n);

  // construye opciones, marcando la actual como selected
  return `
    <select class="actividad-select" data-field="actividad">
      ${ACTIVIDADES.map(act => `
        <option value="${act}" ${current === act ? 'selected' : ''}>
          ${act}
        </option>`).join('')}
    </select>
  `;
}

// ----------------Hora y Fecha ------------------

function toDateValue(s) { if (!s) return ''; const m = String(s).match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : ''; }
function toTimeValue(s) { if (!s) return ''; const m = String(s).match(/^(\d{2}):(\d{2})/); return m ? `${m[1]}:${m[2]}` : ''; }

function startCellEdit(td) {
  if (td.querySelector('select')) return; // no reemplazar selects (sede/actividad)

  const field = td.dataset.field;
  const tr = td.closest('tr');
  const cc = tr?.dataset.id;
  if (!cc || td.classList.contains('ro') || td.querySelector('input')) return;

  const isDate = field === 'fecha_inicio' || field === 'fecha_final';
  const isTime = field === 'hora_inicio' || field === 'hora_final';
  const isNumber = field === 'cantidad' || field === 'tiempo_fallo_minutos';

  const originalText = td.textContent.trim();
  td.dataset.orig = originalText;

  const input = document.createElement('input');
  input.type = isDate ? 'date' : isTime ? 'time' : isNumber ? 'number' : 'text';
  input.className = 'cell-input';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.required = true;          // no nulos

  // Valores iniciales
  if (isDate) {
    input.value = toDateValue(originalText);
  } else if (isTime) {
    input.value = toTimeValue(originalText);
    input.step = 60;              // 1 min
  } else if (isNumber) {
    input.value = originalText === '' ? '' : String(originalText);
    input.min = '0';              // sin negativos
    input.step = 'any';
    input.inputMode = 'numeric';
  } else {
    input.value = originalText;
  }

  // Límites cruzados fecha/hora
  if (isDate) {
    const otherTxt = (field === 'fecha_inicio')
      ? tr.querySelector('td[data-field="fecha_final"]')?.textContent.trim()
      : tr.querySelector('td[data-field="fecha_inicio"]')?.textContent.trim();
    const other = toDateValue(otherTxt);
    if (other) {
      if (field === 'fecha_inicio') input.max = other;
      else input.min = other;
    }
  }
  if (isTime) {
    const fi = toDateValue(tr.querySelector('td[data-field="fecha_inicio"]')?.textContent.trim());
    const ff = toDateValue(tr.querySelector('td[data-field="fecha_final"]')?.textContent.trim());
    if (fi && ff && fi === ff) {
      const otherTxt = (field === 'hora_inicio')
        ? tr.querySelector('td[data-field="hora_final"]')?.textContent.trim()
        : tr.querySelector('td[data-field="hora_inicio"]')?.textContent.trim();
      const other = toTimeValue(otherTxt);
      if (other) {
        if (field === 'hora_inicio') input.max = other;
        else input.min = other;
      }
    }
  }

  // Inserción UI
  td.classList.add('editing');
  td.textContent = '';
  td.appendChild(input);
  input.focus();
  if (isDate || isTime) {
    if (typeof input.showPicker === 'function') { try { input.showPicker(); } catch { } }
  }

  // 🔒 BLOQUEAR TECLADO SOLO EN FECHA/HORA (no en número)
  if (isDate || isTime) {
    input.addEventListener('beforeinput', (e) => e.preventDefault());
    input.addEventListener('keydown', (e) => {
      const ok = ['Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
      if (!ok.includes(e.key)) e.preventDefault();
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('pointerdown', () => {
      if (typeof input.showPicker === 'function') { try { input.showPicker(); } catch { } }
    });
  } else if (isNumber) {
    // Evitar signos negativos y letras
    input.addEventListener('beforeinput', (e) => {
      // permitir dígitos, borrar, mover, pegar con solo dígitos
      if (e.inputType === 'insertFromPaste') {
        const text = (e.dataTransfer || {}).getData?.('text') ?? '';
        if (!/^\d+(\.\d+)?$/.test(text)) e.preventDefault();
      }
      // resto lo maneja el propio <input type="number">
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === '-') e.preventDefault(); // no negativos
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
  } else {
    // texto normal (si tienes otros campos con input)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
  }

  input.addEventListener('change', commit);
  input.addEventListener('blur', commit, { once: true });

  async function commit() {
    const val = input.value.trim();
    const tr = td.closest('tr');
    const id = tr?.dataset.id;

    // Validación común: no permitir vacío en ningún campo
    if (!val) {
      markErrorAndRefocus();
      return;
    }

    let newDisplay = val;

    // Validación específica para cantidad
    if (isNumber) {
      const num = Number(val);
      if (!Number.isFinite(num) || num < 0) {
        markErrorAndRefocus();
        return;
      }
      newDisplay = String(num); // normaliza
    }

    // Validación de constraints nativos (date min/max, time min/max)
    if (!input.checkValidity()) {
      markErrorAndRefocus();
      return;
    }

    // --- AÑADE ESTE NUEVO BLOQUE DE VALIDACIÓN ---
    if (field === 'tiempo_fallo_minutos') {
      const num = Number(val);

      // Validación 1: Mayor a cero
      if (isNaN(num) || num <= 0) {
        td.title = "El valor debe ser un número mayor a cero.";
        markErrorAndRefocus();
        return; // Detiene el guardado
      }

      // Validación 2: No exceder el rango del turno
      const horaInicio = tr.querySelector('td[data-field="hora_inicio"]').textContent.trim();
      const horaFinal = tr.querySelector('td[data-field="hora_final"]').textContent.trim();

      if (horaInicio && horaFinal) {
        const fechaInicio = new Date(`1970-01-01T${horaInicio}`);
        const fechaFinal = new Date(`1970-01-01T${horaFinal}`);
        const rangoEnMinutos = (fechaFinal - fechaInicio) / 60000;

        if (num > rangoEnMinutos) {
          td.title = `El tiempo de fallo (${num} min) no puede exceder el rango del turno (${rangoEnMinutos} min).`;
          markErrorAndRefocus();
          return; // Detiene el guardado
        }
      }
      td.title = ""; // Limpia el tooltip si es válido
    }

    // --- INICIO DE LA VALIDACIÓN DE RANGO ---
    // Si el campo que se editó es una fecha o una hora, valida el rango completo.
    if (isDate || isTime) {
      const esRangoValido = validarRangoFechaHora(tr, field, newDisplay);
      if (!esRangoValido) {
        // La función validarRangoFechaHora ya marcó los errores visualmente.
        // Cancelamos la edición para revertir el texto de la celda actual.
        cancel();
        return; // Detiene el proceso de guardado
      }
    }
    // --- FIN DE LA VALIDACIÓN DE RANGO ---

    // Si todas las validaciones pasan, procede a guardar
    const payload = isNumber ? Number(newDisplay) : newDisplay;
    trackChange(id, field, payload);
    td.textContent = newDisplay;
    td.classList.remove('editing');

  }

  function cancel() {
    td.classList.remove('editing');
    td.textContent = td.dataset.orig ?? '';
  }

  function markErrorAndRefocus() {
    td.classList.add('error');
    setTimeout(() => td.classList.remove('error'), 800);
    input.focus();
    if (isDate || isTime) {
      if (typeof input.showPicker === 'function') { try { input.showPicker(); } catch { } }
    }
  }
}

// ------------------Estado SCI Select-----------------------------------------

// Canonizamos valores/labels para guardar
const ESTADO_A = { value: 'En proceso', label: 'En proceso' };
const ESTADO_B = { value: 'Finalizado', label: 'Finalizado' };
const ESTADO_C = { value: 'N/A', label: 'N/A' };

function renderEstadoSelect(valorBD) {
  // Si el valor es "N/A", retorna un select deshabilitado.
  if (normText(valorBD) === 'n/a') {
    return `
      <select class="estado-select" data-field="estado_sci" disabled>
        <option selected>N/A</option>
      </select>
    `;
  }

  // Si no es "N/A", ejecuta la lógica normal para crear el select editable.
  const n = normText(valorBD);
  const isProceso = n.includes('en proceso') || n.includes('proceso');
  const isFinalizado = n.includes('finalizado');

  const optionA = `<option value="En proceso" ${isProceso ? 'selected' : ''}>En proceso</option>`;
  const optionB = `<option value="Finalizado" ${isFinalizado ? 'selected' : ''}>Finalizado</option>`;

  return `
    <select class="estado-select" data-field="estado_sci">
      ${optionA}
      ${optionB}
    </select>
  `;
}

// ------------------Horario Select--------------------------------------

const HORARIOS = [
  "Horario A (06:00 - 14:00)",
  "Horario B (14:00 - 22:00)",
  "Horario C (22:00 - 06:00)",
  "Horario D (07:00 - 16:00)",
  "Horario E (06:00 - 16:00)",
  "Horario F (06:00 - 18:00)",
  "Horario G (18:00 - 06:00)",
  "Horario H (20:00 - 06:00)",
  "Horario I (06:00 - 17:00)",
  "Horario J (19:00 - 06:00)",
  "Horario K (05:45 - 13:45)",
  "Horario L (14:15 - 22:15)",
  "Horario M (10:00 - 18:00)",
  "Horario N (12:00 - 22:00)",
  "Horario O (08:00 - 16:00)",
  "N/A"
];

function renderHorarioSelect(valorBD) {
  // Si el valor es "N/A", retorna un select deshabilitado.
  if (normText(valorBD) === 'n/a') {
    return `
      <select class="horario-select" data-field="horario" disabled>
        <option selected>N/A</option>
      </select>
    `;
  }

  // Si no es "N/A", ejecuta la lógica normal para crear el select editable.
  const n = normText(valorBD);
  const current = HORARIOS.find(act => normText(act) === n);

  return `
    <select class="horario-select" data-field="horario">
      ${HORARIOS.map(act => `
        <option value="${act}" ${current === act ? 'selected' : ''}>
          ${act}
        </option>`).join('')}
    </select>
  `;
}

// ------------------Observacion Select--------------------------------------

const OBSERVACION = [
  "Fallo de maquina",
  "Falta de insumos",
  "Falta de materias primas",
  "Paro por reuniones",
  "Paro por otras actividades",
  "Falta de programación",
  "Reproceso",
  "N/A"
];

function renderObservacionSelect(valorBD) {
  // Si el valor es "N/A", retorna un select deshabilitado.
  if (normText(valorBD) === 'n/a') {
    return `
      <select class="observaciones-select" data-field="observaciones" disabled>
        <option selected>N/A</option>
      </select>
    `;
  }

  // Si no es "N/A", ejecuta la lógica normal para crear el select editable.
  const n = normText(valorBD);
  const current = OBSERVACION.find(act => normText(act) === n);

  return `
    <select class="observaciones-select" data-field="observaciones">
      ${OBSERVACION.map(act => `
        <option value="${act}" ${current === act ? 'selected' : ''}>
          ${act}
        </option>`).join('')}
    </select>
  `;
}

async function cargar() {

  const q = inputQ.value.trim();
  const id = inputId.value.trim();
  const noOp = inputNoOp.value.trim();
  const sede = SelectSedes.value;


  lista.textContent = 'Cargando…';

  console.log("Filtrando por sede:", sede);

  const query = `
    query ($limit:Int!, $offset:Int!, $q:String, $dateFrom:String, $dateTo:String, $id:ID, $no_op:String, $sede:String) {
      formularios(limit:$limit, offset:$offset, q:$q, dateFrom:$dateFrom, dateTo:$dateTo, id:$id, no_op:$no_op, sede: $sede) {
        total
        count
        items {
          id cc nombres sede no_op sci_ref descripcion_referencia
          fecha_inicio hora_inicio fecha_final hora_final
          actividad estado_sci cantidad area maquina horario observaciones tiempo_fallo_minutos
        }
      }
    }
  `;


  try {
    const data = await gql(query, { limit: pageSize, offset, q, dateFrom, dateTo, id, no_op: noOp, sede });
    const { total: t, count, items } = data.formularios;
    total = t;
    lista.innerHTML = '';

    if (!items.length) {
      lista.innerHTML = '<tr><td colspan="4">🙈 No hay resultados</td></tr>';
    } else {
      items.forEach(it => {
        const tr = document.createElement('tr');
        tr.dataset.id = it.id;
        tr.dataset.cc = it.cc;
        tr.innerHTML = `
          <td data-field="id" class="ro sticky-col id-col">${it.id ?? ''}</td>
          <td id="celda-cc" data-field="cc"              class="ro sticky-col cc-col" tabindex="0">${it.cc ?? ''}</td>
          <td id="celda-nombre" data-field="nombres"         class="ro sticky-col name-col" tabindex="0">${it.nombres ?? ''}</td>
          <td data-field="actividad"       tabindex="0">${renderActividadSelect(it.actividad)}</td>
          <td data-field="sede"            tabindex="0">${renderSedeSelect(it.sede)}</td>
          <td data-field="fecha_inicio"    tabindex="0">${it.fecha_inicio ?? ''}</td>
          <td data-field="fecha_final"     tabindex="0">${it.fecha_final ?? ''}</td>
          <td data-field="hora_inicio"     tabindex="0">${it.hora_inicio ?? ''}</td>
          <td data-field="hora_final"      tabindex="0">${it.hora_final ?? ''}</td>
          <td data-field="no_op" data-original-value="${it.no_op ?? ''}" class="${it.no_op === 'N/A' ? 'ro' : ''}" tabindex="0">${it.no_op ?? ''}</td>
          <td data-field="sci_ref" data-original-value="${it.sci_ref ?? ''}" class="${it.sci_ref === 'N/A' ? 'ro' : ''}" tabindex="0">${it.sci_ref ?? ''}</td>
          <td data-field="descripcion_referencia" data-original-value="${it.descripcion_referencia ?? ''}" class="ro" tabindex="0">${it.descripcion_referencia ?? ''}</td>
          <td data-field="estado_sci" data-original-value="${it.estado_sci ?? ''}" tabindex="0">${renderEstadoSelect(it.estado_sci)}</td>
          <td data-field="cantidad" data-original-value="${it.cantidad ?? 0}" class="${it.cantidad === 0 ? 'ro' : ''}" tabindex="0">${it.cantidad ?? 0}</td>
          <td data-field="area" data-original-value="${it.area ?? ''}" class="${it.area === 'N/A' ? 'ro' : ''}" tabindex="0">${it.area ?? ''}</td>
          <td data-field="maquina" data-original-value="${it.maquina ?? ''}" class="${it.maquina === 'N/A' ? 'ro' : ''}" tabindex="0">${it.maquina ?? ''}</td>
          <td data-field="horario" data-original-value="${it.horario ?? ''}" tabindex="0">${renderHorarioSelect(it.horario)}</td>
          <td data-field="observaciones" data-original-value="${it.observaciones ?? ''}" tabindex="0">${renderObservacionSelect(it.observaciones)}</td>
          <td data-field="tiempo_fallo_minutos" class="${it.observaciones !== 'Fallo de maquina' ? 'ro' : ''}" tabindex="0">${it.tiempo_fallo_minutos ?? 0}</td>
          <td class="acciones"><button class="btn-delete" title="Eliminar este registro">🗑️</button></td>
        `;

        lista.appendChild(tr);
        if (pendingChanges[it.id]) {
          Object.keys(pendingChanges[it.id]).forEach(field => {
            const td = tr.querySelector(`td[data-field="${field}"]`);
            if (td) {
              td.classList.add('changed-field');
            }
          });
        }
      });

    }

    const from = total === 0 ? 0 : offset + 1;
    const to = offset + count;
    if (info) info.textContent = `${from}–${to} de ${total}`;
    if (btnPrev) btnPrev.disabled = offset === 0;
    if (btnNext) btnNext.disabled = offset + count >= total;

    // RESTAURA LA POSICIÓN DEL SCROLL
    window.scrollTo(0, scrollY);


  } catch (e) {
    if (e.name === 'AbortError') return; // se canceló por nueva búsqueda
    console.error(e);
    lista.textContent = 'Error cargando datos.';
    if (info) info.textContent = '';
  }
}

// Inicializa el Litepicker (rango)
const lp = new Litepicker({
  element: pickerEl,
  singleMode: false,      
  format: 'YYYY-MM-DD',
  autoApply: true,
});

// cuando el usuario selecciona rango
lp.on('selected', (date1, date2) => {
  const fmt = d => (typeof d?.format === 'function'
    ? d.format('YYYY-MM-DD')
    : new Date(d).toISOString().slice(0, 10)
  );

  // Usar ambas fechas del rango
  dateFrom = date1 ? fmt(date1) : '';
  dateTo   = date2 ? fmt(date2) : dateFrom;

  // Mostrar el rango en el input
  if (dateFrom && dateTo && dateFrom !== dateTo) {
    pickerEl.value = `${dateFrom} - ${dateTo}`;
  } else if (dateFrom) {
    pickerEl.value = dateFrom;
  } else {
    pickerEl.value = '';
  }

  offset = 0;
  cargar(inputQ.value.trim());
});

// si el usuario limpia el input manualmente
document.getElementById('datepicker').addEventListener('input', (e) => {
  if (!e.target.value) {
    dateFrom = '';
    dateTo   = '';
    offset   = 0;
    try { lp.clearSelection?.(); } catch {}
    cargar(inputQ.value.trim());
  }
});

// util GQL
function placeCaretEnd(el) {
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

async function mutateUpdate(id, patch) {
  const m = `
    mutation ($id: ID!, $patch: FormularioPatch!) {
      updateFormulario(id: $id, patch: $patch) { id }
    }
  `;
  await gql(m, { id, patch });
}

function enableEdit(td) {
  if (td.classList.contains('ro')) return; // no editable
  if (td.isContentEditable) return;

  td.dataset.orig = td.textContent.trim();
  td.contentEditable = 'true';
  td.focus();
  placeCaretEnd(td);
  td.classList.add('editing');
}

function disableEdit(td) {
  td.contentEditable = 'false';
  td.classList.remove('editing');
}

function attachInlineEditingDblClick() {
  // Click para seleccionar la celda (visual)
  lista.addEventListener('click', (e) => {
    const td = e.target.closest('td');
    if (!td) return;
    lista.querySelectorAll('td.selected').forEach(c => c.classList.remove('selected'));
    td.classList.add('selected');
  });

  // Doble-click para iniciar la edición
  lista.addEventListener('dblclick', (e) => {
    const td = e.target.closest('td');
    if (!td || td.classList.contains('ro') || td.classList.contains('acciones')) {
      return; // Si la celda es de solo lectura O es la de acciones, no hagas nada.
    }

    const field = td.dataset.field;

    if (field === 'no_op' || field === 'sci_ref') {
      openOpSciEditor(td);
    } else if (field === 'area' || field === 'maquina') {
      openAreaMaquinaEditor(td);
    } else {
      startCellEdit(td);
    }
  });

  // Guardado para celdas de texto/número al perder el foco (blur)
  lista.addEventListener('blur', (e) => {
    const td = e.target.closest('td[contenteditable="true"]');
    if (!td) return;

    const tr = td.closest('tr');
    if (!tr) return;

    const id = tr.dataset.id;
    const field = td.dataset.field;
    const orig = (td.dataset.orig || '').trim();
    const val = td.textContent.trim();

    disableEdit(td);

    if (val !== orig) {
      const isNumber = field === 'cantidad';
      const payload = isNumber ? Number(val) : val;
      trackChange(id, field, payload);
    }
  }, true);

  // Guardado para celdas con <select> al cambiar su valor
  lista.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-field]');
    if (!sel) return;

    const tr = sel.closest('tr');
    if (!tr) return;

    const id = tr.dataset.id;
    const field = sel.dataset.field;
    const val = sel.value;

    if (!id) {
      return console.error("No se pudo encontrar el 'id' de la fila para el select.");
    }

    trackChange(id, field, val);
  });
}

// Llama esto cada vez que renders tu tabla
attachInlineEditingDblClick();


// Debounce: dispara 300ms después de dejar de escribir
let debounceId;
inputQ.addEventListener('input', () => {
  clearTimeout(debounceId);
  debounceId = setTimeout(() => {
    offset = 0;
    cargar();
  }, 300);
});

// Debounce para el filtro de ID
inputId.addEventListener('input', () => {
  clearTimeout(debounceId);
  debounceId = setTimeout(() => {
    offset = 0;
    cargar();
  }, 300);
});

// Debounce para el filtro de OP
inputNoOp.addEventListener('input', () => {
  clearTimeout(debounceId);
  debounceId = setTimeout(() => {
    offset = 0;
    cargar();
  }, 300);
});

SelectSedes.addEventListener('change', () => {
  offset = 0;
  cargar();
});

btnClear?.addEventListener('click', () => {
  // 1. Limpiar los inputs visualmente
  inputQ.value = '';
  inputId.value = '';
  inputNoOp.value = '';
  SelectSedes.value = '';
  // Limpia el selector de fechas (Litepicker)

  // 2. Reiniciar las variables de estado de los filtros
  dateFrom = '';
  dateTo = '';
  offset = 0; // Reinicia la paginación a la primera página

  // 3. Recargar la tabla con los filtros limpios
  cargar();
});

// Botones y page size
btnPrev?.addEventListener('click', () => {
  offset = Math.max(0, offset - pageSize);
  cargar();
});
btnNext?.addEventListener('click', () => {
  offset = offset + pageSize;
  cargar();
});
selPageSize?.addEventListener('change', (e) => {
  pageSize = Number(e.target.value) || 20;
  offset = 0;
  cargar();
});

// Arranque
cargar('');

// setInterval(() => {
//   console.log('Actualizando datos automáticamente...');
//   cargar();
// }, 30000);


// --------------------------CONTROL OP FILTRO---------------------------------------------------------------
// --- helpers ---
function debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

async function apiBuscarOps(prefix, limit = 8) {
  const q = `query($prefix:String!, $limit:Int){ buscarOpsExcel(prefix:$prefix, limit:$limit) }`;
  const { buscarOpsExcel } = await gql(q, { prefix, limit });
  return buscarOpsExcel || [];
}

async function apiBuscarSciPorOp(op, prefix = '', limit = 20) {
  const q = `query($op:String!, $prefix:String, $limit:Int){ buscarSciPorOp(op:$op, prefix:$prefix, limit:$limit) }`;
  const { buscarSciPorOp } = await gql(q, { op, prefix, limit });
  return buscarSciPorOp || [];
}

async function apiRefPorOpSci(op, sci) {
  const q = `query($op:String!, $sci:String!){ refPorOpSci(op:$op, sci:$sci){ descripcion } }`;
  const { refPorOpSci } = await gql(q, { op, sci });
  return refPorOpSci?.descripcion || '';
}

//----editor embebido------
// Cierra cualquier editor abierto

function closeAnyOpSciEditor() {
  // Elimina cualquier editor abierto
  document.querySelectorAll('.op-sci-editor').forEach(n => n.remove());
  // Elimina cualquier fondo oscuro (overlay)
  document.querySelectorAll('.editor-overlay').forEach(n => n.remove());
  // Quita el resaltado de cualquier fila
  document.querySelectorAll('tr.editing-row').forEach(r => r.classList.remove('editing-row'));
}

// Crea y abre el editor sobre la celda de OP
function openOpSciEditor(tdNoOp) {
  closeAnyOpSciEditor();

  const tr = tdNoOp.closest('tr');
  const tdSci = tr.querySelector('td[data-field="sci_ref"]');
  const tdDR = tr.querySelector('td[data-field="descripcion_referencia"]');
  const id = tr.dataset.id;

  const currOP = (tdNoOp.textContent || '').trim();
  const currSCI = (tdSci?.textContent || '').trim();
  const currDR = (tdDR?.textContent || '').trim();

  const host = document.createElement('div');
  host.className = 'op-sci-editor';

  // --- CAMBIO EN EL HTML: Se añade `readonly` al input de SCI ---
  host.innerHTML = `
    <div class="op-sci-box">
      <label>OP</label>
      <input type="text" class="op-input" placeholder="Buscar OP..." autocomplete="off">
      <div class="op-suggestions suggestions-box"></div>

      <label>SCI</label>
      <input type="text" class="sci-input" placeholder="Seleccione una OP primero..." autocomplete="off" readonly disabled>
      <div class="sci-suggestions suggestions-box"></div>

      <label>Descripción</label>
      <textarea class="dr-output" rows="2" readonly></textarea>

      <div class="opsi-actions">
        <button class="btn-cancel">Cancelar (Esc)</button>
        <button class="btn-save">Guardar (Enter)</button>
      </div>
    </div>
  `;

  // --- Posicionamiento y Referencias (sin cambios) ---
  const rect = tdNoOp.getBoundingClientRect();
  const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
  const scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft;
  host.style.position = 'absolute';
  host.style.left = (rect.left + scrollLeft) + 'px';
  host.style.top = (rect.bottom + scrollTop) + 'px';
  host.style.zIndex = 9999;
  document.body.appendChild(host);
  const overlay = document.createElement('div');
  overlay.className = 'editor-overlay';
  document.body.appendChild(overlay);

  const $opI = host.querySelector('.op-input');
  const $opBox = host.querySelector('.op-suggestions');
  const $sciI = host.querySelector('.sci-input');
  const $sciBox = host.querySelector('.sci-suggestions');
  const $drOut = host.querySelector('.dr-output');
  const $btnOk = host.querySelector('.btn-save');
  const $btnKo = host.querySelector('.btn-cancel');

  let chosenOP = currOP || '';
  let chosenSCI = currSCI || '';
  let descRef = currDR || '';
  let sciPool = [];

  $opI.value = chosenOP;
  $sciI.value = chosenSCI;
  $drOut.value = descRef;

  function closeEditor() {
    tr.classList.remove('editing-row');
    host.remove();
    overlay.remove();
  }

  // --- Función renderSciSuggestions (sin cambios, pero ahora se usa con `click`) ---
  function renderSciSuggestions(list) {
    $sciBox.innerHTML = '';
    if (!list.length) return;
    list.forEach(sci => {
      const row = document.createElement('div');
      row.className = 'sugg-item';
      row.textContent = sci;
      // ✅ CAMBIO CLAVE: Usamos 'click' en lugar de 'mousedown'
      row.addEventListener('click', (ev) => {
        chooseSCI(sci);
      });
      $sciBox.appendChild(row);
    });
  }

  // --- Función renderOpSuggestions (Modificada para usar 'click') ---
  function renderOpSuggestions(list) {
    $opBox.innerHTML = '';
    if (!list.length) {
      $opBox.innerHTML = `<div class="sugg-empty">Sin coincidencias</div>`;
      return;
    }
    list.forEach(op => {
      const row = document.createElement('div');
      row.className = 'sugg-item';
      row.textContent = op;

      row.addEventListener('click', (ev) => {
        chooseOP(op);
      });
      $opBox.appendChild(row);
    });
  }

  async function chooseOP(op) {
    $opBox.innerHTML = '';
    $opI.value = op;
    chosenOP = op;
    chosenSCI = '';
    $sciI.value = '';
    descRef = '';
    $drOut.value = '';

    $sciI.placeholder = 'Cargando SCIs...';
    sciPool = await apiBuscarSciPorOp(chosenOP, '', 200);

    // Muestra las sugerencias de SCI automáticamente
    renderSciSuggestions(sciPool);

    $sciI.placeholder = 'Haga clic para seleccionar SCI';
    $sciI.disabled = false;
  }

  async function chooseSCI(sci) {
    $sciBox.innerHTML = '';
    $sciI.value = sci;
    chosenSCI = sci;

    $drOut.value = 'Buscando descripción...';
    descRef = await apiRefPorOpSci(chosenOP, chosenSCI);
    $drOut.value = descRef;

    $btnOk.focus();
  }

  async function save() {
    // La validación se queda igual
    if (!chosenOP || !chosenSCI) {
      host.querySelector('.op-sci-box').classList.add('opsi-error');
      setTimeout(() => host.querySelector('.op-sci-box').classList.remove('opsi-error'), 800);
      return;
    }

    const realDR = await apiRefPorOpSci(chosenOP, chosenSCI) || '';

    trackChange(id, 'no_op', chosenOP);
    trackChange(id, 'sci_ref', chosenSCI);
    trackChange(id, 'descripcion_referencia', realDR);

    // Actualiza la tabla visualmente
    tdNoOp.textContent = chosenOP;
    tdSci.textContent = chosenSCI;
    tdDR.textContent = realDR;

    // Cierra el editor
    closeEditor();
  }

  // --- Eventos UI (Modificados) ---
  const debOpSearch = debounce(async (txt) => {
    if (!txt.trim()) { $opBox.innerHTML = ''; return; }
    const ops = await apiBuscarOps(txt, 8);
    renderOpSuggestions(ops);
  }, 250);

  $opI.addEventListener('input', (e) => {
    $opBox.style.display = 'block';
    chosenOP = '';
    chosenSCI = '';
    descRef = '';
    $drOut.value = '';
    $sciI.value = '';
    $sciI.disabled = true;
    $sciI.placeholder = 'Seleccione una OP primero...';
    $sciBox.innerHTML = '';
    debOpSearch(e.target.value || '');
  });

  // El input de SCI ahora reacciona a 'click' para mostrar la lista
  $sciI.addEventListener('click', () => {
    // Si ya hay SCIs cargados, los muestra
    if (sciPool.length > 0) {
      renderSciSuggestions(sciPool);
    }
  });

  $btnOk.addEventListener('click', save);
  $btnKo.addEventListener('click', closeEditor);

  host.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); closeEditor(); }
  });

  setTimeout(() => {
    const onDoc = (ev) => {
      if (!host.contains(ev.target)) {
        closeEditor();
        document.removeEventListener('mousedown', onDoc);
      }
    };
    document.addEventListener('mousedown', onDoc);
  }, 0);

  (async () => {
    if (currOP) {
      $sciI.disabled = false;
      $sciI.placeholder = 'Haga clic para seleccionar SCI';
      sciPool = await apiBuscarSciPorOp(currOP, '', 200);
    } else {
      $opI.focus();
    }
  })();
}

// ---------------------------CT PN  y MÁQUINAS-------------------------------
async function apiGetCtpnList() {
  const q = `query { ctpnList }`;
  const { ctpnList } = await gql(q);
  return ctpnList || [];
}

async function apiGetMaquinasPorCtpn(ctpn) {
  const q = `query($ctpn: String!) { maquinasPorCtpn(ctpn: $ctpn) { id maquina} }`;
  const { maquinasPorCtpn } = await gql(q, { ctpn });
  return maquinasPorCtpn || [];
}


function openAreaMaquinaEditor(tdArea) {
  closeAnyOpSciEditor(); // Cierra cualquier otro editor que esté abierto

  const tr = tdArea.closest('tr');
  const tdMaquina = tr.querySelector('td[data-field="maquina"]');
  const cc = tr.dataset.cc;
  const id = tr.dataset.id;

  // Resaltar la fila actual
  tr.classList.add('editing-row');

  // Valores actuales de la tabla
  const currArea = tdArea.textContent.trim();
  const currMaquina = tdMaquina.textContent.trim();

  // Crear el HTML del editor
  const host = document.createElement('div');
  host.className = 'op-sci-editor';
  host.innerHTML = `
    <div class="ctpn-maq-box">
      <label>Área (CT Pn)</label>
      <select class="area-select" disabled>
        <option>Cargando áreas...</option>
      </select>

      <label>Máquina</label>
      <select class="maquina-select" disabled>
        <option>Seleccione un área...</option>
      </select>

      <div class="opsi-actions">
        <button class="btn-cancel">Cancelar</button>
        <button class="btn-save">Guardar</button>
      </div>
    </div>
  `;

  // Posicionamiento centrado y overlay
  host.style.position = 'fixed';
  host.style.left = '50%';
  host.style.top = '50%';
  host.style.transform = 'translate(-50%, -50%) scale(0.95)';
  host.style.zIndex = 10001;
  document.body.appendChild(host);

  const overlay = document.createElement('div');
  overlay.className = 'editor-overlay';
  document.body.appendChild(overlay);

  // Referencias a los elementos del editor
  const $areaSelect = host.querySelector('.area-select');
  const $maquinaSelect = host.querySelector('.maquina-select');
  const $btnOk = host.querySelector('.btn-save');
  const $btnKo = host.querySelector('.btn-cancel');


  /**
   * Carga las máquinas para un área específica y selecciona una si se provee.
   * @param {string} areaSeleccionada - El área (CTPn) por la cual filtrar.
   * @param {string | null} maquinaActual - La máquina que debe quedar seleccionada.
   */
  async function cargarMaquinas(areaSeleccionada, maquinaActual = null) {
    $maquinaSelect.innerHTML = `<option>Cargando máquinas...</option>`;
    $maquinaSelect.disabled = true;

    // Si no hay un área seleccionada, resetea el select de máquinas.
    if (!areaSeleccionada) {
      $maquinaSelect.innerHTML = `<option value="">Seleccione un área...</option>`;
      return;
    }

    const maquinas = await apiGetMaquinasPorCtpn(areaSeleccionada);

    $maquinaSelect.innerHTML = `<option value="">Seleccione una máquina...</option>`;
    maquinas.forEach(m => {
      const esSeleccionada = m.maquina === maquinaActual;
      const optionHTML = `<option value="${m.id}" ${esSeleccionada ? 'selected' : ''}>${m.maquina}</option>`;
      $maquinaSelect.innerHTML += optionHTML;
    });
    $maquinaSelect.disabled = false;
  }

  // Evento: cuando el usuario cambia el área, recarga las máquinas.
  $areaSelect.addEventListener('change', () => {
    const nuevaArea = $areaSelect.value;
    cargarMaquinas(nuevaArea); // Simplemente llama a la función de carga
  });

  // --- Lógica de Guardado y Cancelación (Sin cambios) ---

  function closeEditor() {
    tr.classList.remove('editing-row');
    host.remove();
    overlay.remove();
  }

  // EN: script.js -> dentro de la función openAreaMaquinaEditor

  async function save() {
    const nuevaArea = $areaSelect.value;
    const nuevaMaquina = $maquinaSelect.value;

    // La validación se queda igual
    if (!nuevaArea || !nuevaMaquina) {
      host.querySelector('.ctpn-maq-box').classList.add('opsi-error'); // Corregido para usar la clase correcta
      setTimeout(() => host.querySelector('.ctpn-maq-box').classList.remove('opsi-error'), 500);
      return;
    }

    // ✅ REEMPLAZO: En lugar de guardar, registra los 2 cambios
    trackChange(id, 'area', nuevaArea);
    trackChange(id, 'maquina', nuevaMaquina);

    // Actualiza la tabla visualmente
    tdArea.textContent = nuevaArea;
    tdMaquina.textContent = nuevaMaquina;

    // Cierra el editor
    closeEditor();
  }



  $btnOk.addEventListener('click', save);
  $btnKo.addEventListener('click', closeEditor);
  overlay.addEventListener('click', closeEditor);

  setTimeout(() => {
    const onDoc = (ev) => {
      if (!host.contains(ev.target)) {
        closeEditor();
        document.removeEventListener('mousedown', onDoc);
      }
    };
    document.addEventListener('mousedown', onDoc);
  }, 0);

  // --- Carga Inicial de Datos (Mejorada) ---
  (async () => {
    try {
      // 1. Carga la lista completa de áreas
      const areas = await apiGetCtpnList();
      $areaSelect.innerHTML = `<option value="">Seleccione un área...</option>`;
      areas.forEach(a => {
        const esSeleccionada = a === currArea;
        const optionHTML = `<option value="${a}" ${esSeleccionada ? 'selected' : ''}>${a}</option>`;
        $areaSelect.innerHTML += optionHTML;
      });
      $areaSelect.disabled = false;

      // 2. Si ya hay un área en la fila, carga sus máquinas correspondientes
      if (currArea) {
        await cargarMaquinas(currArea, currMaquina);
      }
    } catch (err) {
      console.error("Error al inicializar el editor de Área/Máquina:", err);
      $areaSelect.innerHTML = `<option>Error al cargar</option>`;
    }
  })();
}

function trackChange(id, field, value) {
  console.log(`CAMBIO REGISTRADO: ID=${id}, Campo=${field}, Valor=${value}`);

  if (!pendingChanges[id]) {
    pendingChanges[id] = {};
  }
  pendingChanges[id][field] = value;
  updateSaveButtonState();

  // ✅ AÑADIR: Resaltar la celda visualmente
  const tr = lista.querySelector(`tr[data-id="${id}"]`);
  if (tr) {
    const td = tr.querySelector(`td[data-field="${field}"]`);
    if (td) {
      // Para celdas editables o con contenido
      td.classList.add('changed-field');
    } else {
      // Para selects directamente en el td (como actividad o sede)
      const select = tr.querySelector(`select[data-field="${field}"]`);
      if (select) {
        select.classList.add('changed-field');
        // También podemos querer resaltar el <td> padre si el select está dentro
        select.closest('td')?.classList.add('changed-field');
      }
    }
  }
}

async function saveAllChanges() {
  console.log("Botón 'Guardar Cambios' presionado. Iniciando proceso de guardado...");

  let todosLosErrores = [];
  const idsConCambios = Object.keys(pendingChanges);

  // Itera sobre cada ID que tiene cambios pendientes
  for (const id of idsConCambios) {
    const tr = lista.querySelector(`tr[data-id="${id}"]`);
    if (tr) {
      const erroresDeLaFila = validarFilaCompleta(tr);
      // Concatena los errores encontrados en la lista general
      todosLosErrores = todosLosErrores.concat(erroresDeLaFila);
    }
  }

  // Si la lista de errores tiene algo, muestra la alerta y detiene todo
  if (todosLosErrores.length > 0) {
    alert("🛑 No se puede guardar. Por favor, corrija los siguientes errores:\n\n" + todosLosErrores.join("\n"));
    return; // Detiene la ejecución de la función AQUÍ MISMO
  }

  const updates = Object.entries(pendingChanges).map(([id, patch]) => ({
    id,
    patch,
  }));

  if (updates.length === 0) {
    console.log("No hay cambios pendientes para guardar.");
    return;
  }

  console.log("Datos que se enviarán al servidor:", updates);

  const confirmSave = confirm(`¿Estás seguro de que deseas guardar ${updates.length} cambio(s)?`);
  if (!confirmSave) return;

  btnGuardar.disabled = true;
  saveStatus.textContent = '⚙️ Guardando...';
  saveStatus.dataset.status = 'saving';

  try {
    const m = `mutation($updates: [FormularioUpdateInput!]!) {
      updateMultiplesFormularios(updates: $updates)
    }`;
    await gql(m, { updates });

    pendingChanges = {}; // Limpia el registro de cambios
    updateSaveButtonState(); // Actualiza el estado a "Guardado"

    // Quitar resaltado de todos los campos al guardar con éxito
    document.querySelectorAll('.changed-field').forEach(el => {
      el.classList.remove('changed-field');
    });

  } catch (err) {
    console.error('Error al guardar cambios:', err);
    saveStatus.textContent = '❌ Error al guardar. Revisa la consola.';
    saveStatus.dataset.status = 'error';
    btnGuardar.disabled = false; // Permite reintentar
  }
}

// Asigna el evento al botón
btnGuardar.addEventListener('click', saveAllChanges);

// --- 2. CREAR LA FUNCIÓN PARA POBLAR EL SELECT ---
async function popularFiltroSede() {
  const selectSede = document.getElementById('filtroSede');

  const query = `
        query GetSedes {
            sedesDisponibles
        }
    `;

  try {
    const data = await gql(query);
    const sedes = data.sedesDisponibles || [];

    sedes.forEach(sede => {
      const option = document.createElement('option');
      option.value = sede;
      option.textContent = sede;
      selectSede.appendChild(option);
    });
  } catch (error) {
    console.error("Error al cargar la lista de sedes:", error);
  }
}

async function inicializarPagina() {
  try {
    // Primero, ESPERAMOS a que el select de sedes se llene
    await popularFiltroSede();

    // SOLO DESPUÉS, cargamos la tabla inicial
    await cargar();
  } catch (error) {
    console.error("Error en la inicialización de la página:", error);
    lista.textContent = 'Error al inicializar la página.';
  }
}

// Llama a la función de arranque cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', inicializarPagina);

/**
 * Valida todos los campos críticos de una fila y devuelve un array de errores.
 * Marca visualmente las celdas con error.
 * @param {HTMLTableRowElement} tr - La fila <tr> a validar.
 * @returns {string[]} - Un array de mensajes de error. Array vacío si todo es válido.
 */
function validarFilaCompleta(tr) {
  const errores = [];
  const id = tr.dataset.id;

  // 1. Reutilizar la validación de rango de fecha/hora que ya tienes
  // El 'null, null' es porque la función leerá los valores directamente del DOM
  if (!validarRangoFechaHora(tr, null, null)) {
    errores.push(`ID ${id}: El rango de fechas es inválido (la fecha final debe ser mayor y no superar las 14 horas).`);
  }

  // 2. Validar que la cantidad sea un número válido
  const tdCantidad = tr.querySelector('td[data-field="cantidad"]');
  const cantidad = Number(tdCantidad.textContent.trim());
  if (isNaN(cantidad) || cantidad < 0) {
    tdCantidad.classList.add('error');
    errores.push(`ID ${id}: El campo 'cantidad' debe ser un número mayor o igual a cero.`);
  }

  // 3. Validar 'tiempo_fallo_minutos' según la actividad
  const tdTiempoFallo = tr.querySelector('td[data-field="tiempo_fallo_minutos"]');
  const tiempoFallo = Number(tdTiempoFallo.textContent.trim());
  const actividadSelect = tr.querySelector('select[data-field="actividad"]');

  if (actividadSelect && actividadSelect.value === "Falla mecanica") {
    if (isNaN(tiempoFallo) || tiempoFallo <= 0) {
      tdTiempoFallo.classList.add('error');
      errores.push(`ID ${id}: Si la actividad es "Falla mecanica", el tiempo de fallo debe ser mayor a cero.`);
    }
  }

  // Limpiar la marca de error visual después de un par de segundos
  setTimeout(() => {
    tr.querySelectorAll('td.error').forEach(td => td.classList.remove('error'));
  }, 2500);

  return errores;
}

// ----------------------DELETE --------------------------------------
// --- LÓGICA DE ELIMINACIÓN DE REGISTROS ---

/**
 * Se ejecuta cuando el usuario confirma que quiere eliminar un registro.
 * Llama a la mutación de GraphQL y elimina la fila de la tabla.
 * @param {string} id - El ID del registro a eliminar.
 */
async function handleDelete(id) {
  // 1. Pide confirmación al usuario con SweetAlert
  const result = await Swal.fire({
    title: '¿Estás seguro?',
    text: `Esta acción eliminará el registro con ID: ${id}. ¡No se puede deshacer!`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, ¡eliminar!',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    background: '#ebd5c0',
    color: '#000'
  });

  // Si el usuario no confirma, no hacemos nada
  if (!result.isConfirmed) {
    return;
  }

  // 2. Define y ejecuta la mutación de GraphQL
  const DELETE_MUTATION = `
    mutation DeleteFormulario($id: ID!) {
      deleteFormulario(id: $id) {
        id # Pedimos el id de vuelta para confirmar
      }
    }
  `;

  try {
    await gql(DELETE_MUTATION, { id });

    // 3. Si la mutación tiene éxito, elimina la fila de la tabla
    const filaAEliminar = document.querySelector(`tr[data-id="${id}"]`);
    if (filaAEliminar) {
      filaAEliminar.remove();
    }

    Swal.fire({
      title: '¡Eliminado!',
      text: `El registro ${id} ha sido eliminado.`,
      icon: 'success',
      background: '#ebd5c0',
      color: '#000'
    });

  } catch (error) {
    console.error("Error al eliminar el registro:", error);
    Swal.fire({
      title: 'Error',
      text: 'No se pudo eliminar el registro.',
      icon: 'error',
      background: '#ebd5c0',
      color: '#000'
    });
  }
}

// Event Listener en la tabla para delegar los clics
lista.addEventListener('click', (e) => {
  // Buscamos si el clic fue en un botón de eliminar o dentro de uno
  const deleteButton = e.target.closest('.btn-delete');

  if (deleteButton) {
    const tr = deleteButton.closest('tr');
    const id = tr.dataset.id;
    if (id) {
      handleDelete(id);
    }
  }
});