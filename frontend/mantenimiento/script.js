async function gqlFetch(query, variables = {}) {
    const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '));
    return json.data;
}

// usa el import global gql si existe; si no, el fallback
const GQL = async (query, variables) =>
    (typeof gql === 'function' ? gql(query, variables) : gqlFetch(query, variables));

const QUERY_USUARIOS_MANTENIMIENTO = `
query {
  usuariosMantenimiento {
    id
    nombre
    cedula
  }
}
`;

const QUERY_TIPOS_MANTENIMIENTO = `
query {
  tiposMantenimiento {
    id
    tipo
  }
}
`;

const MUT = `
mutation CrearParoConIntervencion($paro: ParoInput!, $intervencion: IntervencionInput!) {
  crearParoConIntervencion(paro: $paro, intervencion: $intervencion) {
    id
    usuario
    tipo_maquina
    paro_maquina
    estado
    fecha_registro
  }
}
`;

const text = v => String(v ?? '').trim();

function readObservacion() {
    const el = document.getElementById('mant-observacion');
    if (!el) return '';
    if ('value' in el) return text(el.value);
    return text(el.innerText);
}

// Construye el input con fecha en formato 'YYYY-MM-DD' (o null)
function buildInput() {
    const usuario = text(document.getElementById('mant-user')?.value);

    // Obtener cédula del dataset del usuario seleccionado
    const selectUsuario = document.getElementById('mant-user');
    const selectedOption = selectUsuario?.options[selectUsuario.selectedIndex];
    const cedula = parseInt(selectedOption?.dataset?.cedula) || 0;

    const tipo_maquina = text(document.getElementById('mant-tipo-maquina')?.value);
    const tipo_mantenimiento = text(document.getElementById('mant-tipo-mantenimiento')?.value);
    let paro_maquina = text(document.getElementById('mant-paro')?.value);
    const observacion = readObservacion();

    // Lógica: preventivo y correctivo siempre tienen paro de máquina
    const tipoMantLower = (tipo_mantenimiento || '').toLowerCase();
    const isPreventivo = tipoMantLower === 'preventivo';
    const isCorrectivo = tipoMantLower === 'correctivo';
    const isPredictivo = tipoMantLower === 'predictivo';
    const isInspeccion = tipoMantLower === 'inspección';

    // Repuesto: array vacío si es predictivo o inspección, sino obtener repuestos
    const repuesto = (isPredictivo || isInspeccion) ? [] : getRepuestos();

    if (isPreventivo || isCorrectivo) {
        paro_maquina = 'si';
    }

    const paroMaquinaLower = (paro_maquina || '').toLowerCase();
    const isNoParo = paroMaquinaLower === 'no';

    const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
    const readTime = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const v = String(el.value ?? '').trim();
        return v && timeRegex.test(v) ? v : null;
    };

    const readDate = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const v = String(el.value ?? '').trim();
        return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    };

    let fecha_intervencion_inicio, hora_intervencion_inicio, fecha_intervencion_final, hora_intervencion_final;
    let fecha_paro_inicio, hora_paro_inicio, fecha_paro_final, hora_paro_final;

    // Si es preventivo, leer de PARO y duplicar en INTERVENCIÓN (modo espejo)
    if (isPreventivo) {
        fecha_paro_inicio = readDate('mant-fecha-paro-inicio');
        hora_paro_inicio = readTime('mant-hora-paro-inicio');
        fecha_paro_final = readDate('mant-fecha-paro-final');
        hora_paro_final = readTime('mant-hora-paro-final');

        // Duplicar paro en intervención
        fecha_intervencion_inicio = fecha_paro_inicio;
        hora_intervencion_inicio = hora_paro_inicio;
        fecha_intervencion_final = fecha_paro_final;
        hora_intervencion_final = hora_paro_final;
    }
    // Si es predictivo o inspección
    else if (isPredictivo || isInspeccion) {
        if (paroMaquinaLower === 'si') {
            // Detenido: leer paro y duplicar en intervención (modo espejo)
            fecha_paro_inicio = readDate('mant-fecha-paro-inicio');
            hora_paro_inicio = readTime('mant-hora-paro-inicio');
            fecha_paro_final = readDate('mant-fecha-paro-final');
            hora_paro_final = readTime('mant-hora-paro-final');

            fecha_intervencion_inicio = fecha_paro_inicio;
            hora_intervencion_inicio = hora_paro_inicio;
            fecha_intervencion_final = fecha_paro_final;
            hora_intervencion_final = hora_paro_final;
        } else {
            // Operando: leer solo intervención, paro null
            fecha_intervencion_inicio = readDate('mant-fecha-intervencion-inicio');
            hora_intervencion_inicio = readTime('mant-hora-intervencion-inicio');
            fecha_intervencion_final = readDate('mant-fecha-intervencion-final');
            hora_intervencion_final = readTime('mant-hora-intervencion-final');

            fecha_paro_inicio = null;
            hora_paro_inicio = null;
            fecha_paro_final = null;
            hora_paro_final = null;
        }
    }
    else if (isNoParo) {
        // Si no hay paro, leer solo intervención
        fecha_intervencion_inicio = readDate('mant-fecha-intervencion-inicio');
        hora_intervencion_inicio = readTime('mant-hora-intervencion-inicio');
        fecha_intervencion_final = readDate('mant-fecha-intervencion-final');
        hora_intervencion_final = readTime('mant-hora-intervencion-final');

        fecha_paro_inicio = null;
        hora_paro_inicio = null;
        fecha_paro_final = null;
        hora_paro_final = null;
    } else {
        // Correctivo u otros: leer normalmente ambos campos
        fecha_intervencion_inicio = readDate('mant-fecha-intervencion-inicio');
        hora_intervencion_inicio = readTime('mant-hora-intervencion-inicio');
        fecha_intervencion_final = readDate('mant-fecha-intervencion-final');
        hora_intervencion_final = readTime('mant-hora-intervencion-final');

        fecha_paro_inicio = readDate('mant-fecha-paro-inicio');
        hora_paro_inicio = readTime('mant-hora-paro-inicio');
        fecha_paro_final = readDate('mant-fecha-paro-final');
        hora_paro_final = readTime('mant-hora-paro-final');
    }

    // Estado: "finalizado" si el checkbox está marcado, "continuidad" si no
    const finalizadoCheckbox = document.getElementById('mant-finalizado');
    const estado = finalizadoCheckbox?.checked ? 'finalizado' : 'continuidad';

    console.log('=== DEBUG ESTADO ===');
    console.log('Checkbox encontrado:', finalizadoCheckbox);
    console.log('Checkbox checked:', finalizadoCheckbox?.checked);
    console.log('Estado final:', estado);

    // Separar en dos objetos: paro e intervención
    const paro = {
        usuario,
        cedula,
        tipo_maquina,
        paro_maquina,
        fecha_paro_inicio,
        hora_paro_inicio,
        fecha_paro_final,
        hora_paro_final,
        estado
    };

    const intervencion = {
        tipo_mantenimiento,
        observacion,
        repuesto,
        usuario_intervencion: usuario,
        cedula_intervencion: cedula,
        fecha_intervencion_inicio,
        hora_intervencion_inicio,
        fecha_intervencion_final,
        hora_intervencion_final
    };

    return { paro, intervencion };
}

function validar({ paro, intervencion }) {
    const errores = [];
    const req = v => v && v.length > 0;

    if (!req(paro.usuario)) errores.push('Usuario');
    if (!req(paro.tipo_maquina)) errores.push('Tipo de máquina');
    if (!req(intervencion.tipo_mantenimiento)) errores.push('Tipo de mantenimiento');

    const tipoMantLower = (intervencion.tipo_mantenimiento || '').toLowerCase();
    const isPreventivo = tipoMantLower === 'preventivo';
    const isCorrectivo = tipoMantLower === 'correctivo';
    const isPredictivo = tipoMantLower === 'predictivo';
    const isInspeccion = tipoMantLower === 'inspección';
    const paroValue = (paro.paro_maquina || '').toLowerCase();

    // Si es preventivo, validar solo fechas y horas de PARO (intervención se duplicará)
    if (isPreventivo) {
        if (!req(paro.fecha_paro_inicio)) errores.push('Fecha paro inicio');
        if (!req(paro.hora_paro_inicio)) errores.push('Hora paro inicio');
        if (!req(paro.fecha_paro_final)) errores.push('Fecha paro final');
        if (!req(paro.hora_paro_final)) errores.push('Hora paro final');
    }
    // Si es correctivo, validar ambos: intervención Y paro
    else if (isCorrectivo) {
        if (!req(intervencion.fecha_intervencion_inicio)) errores.push('Fecha intervención inicio');
        if (!req(intervencion.hora_intervencion_inicio)) errores.push('Hora intervención inicio');
        if (!req(intervencion.fecha_intervencion_final)) errores.push('Fecha intervención final');
        if (!req(intervencion.hora_intervencion_final)) errores.push('Hora intervención final');

        if (!req(paro.fecha_paro_inicio)) errores.push('Fecha paro inicio');
        if (!req(paro.hora_paro_inicio)) errores.push('Hora paro inicio');
        if (!req(paro.fecha_paro_final)) errores.push('Fecha paro final');
        if (!req(paro.hora_paro_final)) errores.push('Hora paro final');
    }
    // Si es predictivo o inspección
    else if (isPredictivo || isInspeccion) {
        if (paroValue === 'si') {
            // Si está detenido, validar solo paro (intervención se duplica)
            if (!req(paro.fecha_paro_inicio)) errores.push('Fecha paro inicio');
            if (!req(paro.hora_paro_inicio)) errores.push('Hora paro inicio');
            if (!req(paro.fecha_paro_final)) errores.push('Fecha paro final');
            if (!req(paro.hora_paro_final)) errores.push('Hora paro final');
        } else {
            // Si está operando, validar solo intervención (paro es null)
            if (!req(intervencion.fecha_intervencion_inicio)) errores.push('Fecha intervención inicio');
            if (!req(intervencion.hora_intervencion_inicio)) errores.push('Hora intervención inicio');
            if (!req(intervencion.fecha_intervencion_final)) errores.push('Fecha intervención final');
            if (!req(intervencion.hora_intervencion_final)) errores.push('Hora intervención final');
        }
    }
    // Para otros tipos
    else {
        // Siempre validar intervención
        if (!req(intervencion.fecha_intervencion_inicio)) errores.push('Fecha intervención inicio');
        if (!req(intervencion.hora_intervencion_inicio)) errores.push('Hora intervención inicio');
        if (!req(intervencion.fecha_intervencion_final)) errores.push('Fecha intervención final');
        if (!req(intervencion.hora_intervencion_final)) errores.push('Hora intervención final');

        // Solo validar paro si paro_maquina es "si"
        if (paroValue === 'si') {
            if (!req(paro.fecha_paro_inicio)) errores.push('Fecha paro inicio');
            if (!req(paro.hora_paro_inicio)) errores.push('Hora paro inicio');
            if (!req(paro.fecha_paro_final)) errores.push('Fecha paro final');
            if (!req(paro.hora_paro_final)) errores.push('Hora paro final');
        }
    }

    return errores;
}

function timeToSeconds(t) {
    if (!t) return null;
    const parts = String(t).trim().split(':').map(x => Number(x));
    if (parts.length < 2 || parts.some(p => Number.isNaN(p))) return null;
    return (parts[0] * 3600) + (parts[1] * 60) + (parts[2] || 0);
}

// valida orden temporal de fechas y horas; devuelve mensaje de error o null
function checkTimeOrder({ paro, intervencion }) {
    // intervención
    if (intervencion.fecha_intervencion_inicio && intervencion.hora_intervencion_inicio &&
        intervencion.fecha_intervencion_final && intervencion.hora_intervencion_final) {

        const inicio = new Date(`${intervencion.fecha_intervencion_inicio}T${intervencion.hora_intervencion_inicio}`);
        const final = new Date(`${intervencion.fecha_intervencion_final}T${intervencion.hora_intervencion_final}`);

        if (isNaN(inicio.getTime()) || isNaN(final.getTime())) {
            return 'Formato de fecha u hora de intervención inválido';
        }
        if (final < inicio) {
            return 'La fecha/hora de intervención final no puede ser anterior a la inicial.';
        }
    }

    // paro (solo si aplica)
    const paroVal = (paro.paro_maquina || '').toLowerCase();
    if (paroVal !== 'no') {
        if (paro.fecha_paro_inicio && paro.hora_paro_inicio &&
            paro.fecha_paro_final && paro.hora_paro_final) {

            const inicio = new Date(`${paro.fecha_paro_inicio}T${paro.hora_paro_inicio}`);
            const final = new Date(`${paro.fecha_paro_final}T${paro.hora_paro_final}`);

            if (isNaN(inicio.getTime()) || isNaN(final.getTime())) {
                return 'Formato de fecha u hora de paro inválido';
            }
            if (final < inicio) {
                return 'La fecha/hora de paro final no puede ser anterior a la inicial.';
            }
        }
    }

    return null;
}

function syncFieldsByTipoMantenimiento() {
    const tipoMantenimiento = (document.getElementById('mant-tipo-mantenimiento')?.value || '').trim().toLowerCase();
    const selectParo = document.getElementById('mant-paro');

    const isPreventivo = tipoMantenimiento === 'preventivo';
    const isCorrectivo = tipoMantenimiento === 'correctivo';
    const isPredictivo = tipoMantenimiento === 'predictivo';
    const isInspeccion = tipoMantenimiento === 'inspección';

    // Mostrar/ocultar cuadro de repuestos
    const cuadroRepuestos = document.getElementById('cuadro-repuestos');
    if (cuadroRepuestos) {
        if (isPredictivo || isInspeccion) {
            cuadroRepuestos.style.display = 'none';
        } else {
            cuadroRepuestos.style.display = 'grid';
        }
    }

    // Si es preventivo o correctivo, paro_maquina siempre es "si"
    if (isPreventivo || isCorrectivo) {
        if (selectParo) {
            selectParo.value = 'si';
            selectParo.disabled = true;
        }
    }
    // Si es predictivo o inspección, habilitar el select de paro
    else if (isPredictivo || isInspeccion) {
        if (selectParo) {
            selectParo.disabled = false;
        }
    }
    else {
        // Para otros tipos, habilitar el select de paro
        if (selectParo) {
            selectParo.disabled = false;
        }
    }

    // Obtener contenedores de fecha/hora
    const contenedorIntervencion = document.querySelector('.datetime-intervencion');
    const contenedorParo = document.querySelector('.datetime-paro');

    // Si es preventivo: ocultar intervención, mostrar paro (modo espejo paro->intervención)
    if (isPreventivo) {
        if (contenedorIntervencion) contenedorIntervencion.style.display = 'none';
        if (contenedorParo) contenedorParo.style.display = 'grid';
        // Activar espejo inicial
        mirrorFields();
    }
    // Si es correctivo: mostrar ambos
    else if (isCorrectivo) {
        if (contenedorIntervencion) contenedorIntervencion.style.display = 'grid';
        if (contenedorParo) contenedorParo.style.display = 'grid';
    }
    // Si es predictivo o inspección, usar lógica basada en el valor de paro_maquina
    else if (isPredictivo || isInspeccion) {
        syncHorasByParo();
    }
    // Para otros tipos, mostrar intervención y usar la lógica normal de paro
    else {
        if (contenedorIntervencion) contenedorIntervencion.style.display = 'grid';
        syncHorasByParo();
    }
}

function syncHorasByParo() {
    const tipoMantenimiento = (document.getElementById('mant-tipo-mantenimiento')?.value || '').trim().toLowerCase();

    // Si es preventivo o correctivo, no hacer nada (se maneja en syncFieldsByTipoMantenimiento)
    if (tipoMantenimiento === 'preventivo' || tipoMantenimiento === 'correctivo') {
        return;
    }

    const paro = (document.getElementById('mant-paro')?.value || '').trim().toLowerCase();
    const isPredictivo = tipoMantenimiento === 'predictivo';
    const isInspeccion = tipoMantenimiento === 'inspección';

    const contenedorIntervencion = document.querySelector('.datetime-intervencion');
    const contenedorParo = document.querySelector('.datetime-paro');

    // Para predictivo e inspección
    if (isPredictivo || isInspeccion) {
        if (paro === 'si') {
            // Máquina detenida: ocultar intervención, mostrar paro (modo espejo paro->intervención)
            if (contenedorIntervencion) contenedorIntervencion.style.display = 'none';
            if (contenedorParo) contenedorParo.style.display = 'grid';
            // Activar espejo
            mirrorFields();
        } else {
            // Máquina operando (no): mostrar intervención, ocultar paro
            if (contenedorIntervencion) contenedorIntervencion.style.display = 'grid';
            if (contenedorParo) contenedorParo.style.display = 'none';
            // Limpiar campos de paro
            ['mant-fecha-paro-inicio', 'mant-hora-paro-inicio', 'mant-fecha-paro-final', 'mant-hora-paro-final']
                .forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
        }
    }
    // Para otros tipos
    else {
        if (paro === 'no') {
            // Ocultar paro
            if (contenedorParo) contenedorParo.style.display = 'none';
            // Limpiar campos de paro
            ['mant-fecha-paro-inicio', 'mant-hora-paro-inicio', 'mant-fecha-paro-final', 'mant-hora-paro-final']
                .forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
        } else {
            // Mostrar paro
            if (contenedorParo) contenedorParo.style.display = 'grid';
        }
    }
}

// Función de espejo bidireccional universal
// Copia valores del campo visible al campo oculto
// NO copia si el contenedor destino está oculto (display: none)
function mirrorFields() {
    const tipoMantenimiento = (document.getElementById('mant-tipo-mantenimiento')?.value || '').trim().toLowerCase();
    const paro = (document.getElementById('mant-paro')?.value || '').trim().toLowerCase();

    const isPreventivo = tipoMantenimiento === 'preventivo';
    const isPredictivo = tipoMantenimiento === 'predictivo';
    const isInspeccion = tipoMantenimiento === 'inspección';

    const contenedorIntervencion = document.querySelector('.datetime-intervencion');
    const contenedorParo = document.querySelector('.datetime-paro');

    // Solo activar espejo en estos casos específicos:
    // - Preventivo (siempre) - paro -> intervención (intervención oculta)
    // - Predictivo/Inspección con paro = "si" (detenido) - paro -> intervención (intervención oculta)
    // NO aplicar espejo si es Predictivo/Inspección con paro = "no" porque paro debe ser null

    // Verificar si debemos hacer espejo
    if (isPreventivo) {
        // Preventivo: copiar paro -> intervención (intervención está oculta)
        if (!contenedorParo || contenedorParo.style.display === 'none') return;
    } else if ((isPredictivo || isInspeccion) && paro === 'si') {
        // Predictivo/Inspección detenido: copiar paro -> intervención (intervención está oculta)
        if (!contenedorParo || contenedorParo.style.display === 'none') return;
    } else {
        // En cualquier otro caso, NO hacer espejo
        return;
    }

    const pairs = [
        { intervencion: 'mant-fecha-intervencion-inicio', paro: 'mant-fecha-paro-inicio' },
        { intervencion: 'mant-hora-intervencion-inicio', paro: 'mant-hora-paro-inicio' },
        { intervencion: 'mant-fecha-intervencion-final', paro: 'mant-fecha-paro-final' },
        { intervencion: 'mant-hora-intervencion-final', paro: 'mant-hora-paro-final' }
    ];

    pairs.forEach(({ intervencion, paro }) => {
        const intervencionEl = document.getElementById(intervencion);
        const paroEl = document.getElementById(paro);

        if (!intervencionEl || !paroEl) return;

        // Para preventivo y predictivo/inspección con paro="si": copiar paro -> intervención
        if (isPreventivo || ((isPredictivo || isInspeccion) && paro === 'si')) {
            intervencionEl.value = paroEl.value;
        }
    });
}

async function guardar(e) {
    e?.preventDefault?.();

    const btn = document.getElementById('mant-guardar');
    const data = buildInput();
    const errores = validar(data);

    if (errores.length) {
        if (window.Swal) {
            await Swal.fire({
                icon: 'error',
                title: 'Campos obligatorios',
                html: `<p>Completa:</p><ul style="text-align:left;margin-left:18px; display:grid; grid-template-columns: 1fr 1fr;">${errores.map(x => `<li>${x}</li>`).join('')}</ul>`,
                confirmButtonColor: '#ed6b07',
                background: '#ebd5c0',
                color: '#000',
            });
        } else {
            alert('Completa: ' + errores.join(', '));
        }
        return;
    }

    const timeError = checkTimeOrder(data);
    if (timeError) {
        if (window.Swal) {
            await Swal.fire({
                icon: 'warning',
                title: 'Error en las horas',
                text: timeError,
                confirmButtonColor: '#ed6b07',
                background: '#fff3cd'
            });
        } else {
            alert(timeError);
        }
        return;
    }

    try {
        if (btn) { btn.disabled = true; btn.dataset._txt = btn.textContent; btn.textContent = 'Guardando…'; }

        console.log('=== DEBUG GUARDAR ===');
        console.log('Paro:', JSON.stringify(data.paro, null, 2));
        console.log('Intervención:', JSON.stringify(data.intervencion, null, 2));

        const result = await GQL(MUT, data);
        const out = result?.crearParoConIntervencion || result;
        if (!out || !out.id) throw new Error('Respuesta inválida del servidor');

        if (window.Swal) {
            await Swal.fire({
                icon: 'success',
                title: 'Paro e Intervención registrados',
                text: `ID Paro: #${out.id}`,
                confirmButtonColor: '#ed6b07',
                background: '#ebd5c0',
                color: '#000',
                iconColor: '#16a34a',
            });
        }

        // Reset de campos
        const clear = id => { const n = document.getElementById(id); if (n) n.value = ''; };
        clear('mant-user');
        clear('mant-tipo-maquina');
        clear('mant-tipo-mantenimiento');
        clear('mant-paro');
        clear('mant-repuesto');
        clear('mant-fecha-intervencion-inicio');
        clear('mant-hora-intervencion-inicio');
        clear('mant-fecha-intervencion-final');
        clear('mant-hora-intervencion-final');
        clear('mant-fecha-paro-inicio');
        clear('mant-hora-paro-inicio');
        clear('mant-fecha-paro-final');
        clear('mant-hora-paro-final');
        clear('mant-finalizado');

        const repList = document.getElementById('mant-repuestos-list');
        if (repList) {
            repList.innerHTML = `<input type="text" class="mant-repuesto" placeholder="Repuesto usado">`;
        }

        const obs = document.getElementById('mant-observacion');
        if (obs) ('value' in obs) ? (obs.value = '') : (obs.innerText = '');

        // Limpiar checkbox de estado
        const finalizadoCheckbox = document.getElementById('mant-finalizado');
        if (finalizadoCheckbox) finalizadoCheckbox.checked = false;

        // Establecer fechas de hoy por defecto
        const setToday = (id) => {
            const f = document.getElementById(id);
            if (f) {
                const d = new Date();
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                f.value = `${year}-${month}-${day}`;
            }
        };
        setToday('mant-fecha-intervencion-inicio');
        setToday('mant-fecha-intervencion-final');
        setToday('mant-fecha-paro-inicio');
        setToday('mant-fecha-paro-final');

        // Restablecer estados de campos según tipo de mantenimiento
        const paroSelect = document.getElementById('mant-paro');
        if (paroSelect) paroSelect.disabled = false;

        // Mostrar todos los contenedores de fecha/hora
        const contenedorIntervencion = document.querySelector('.datetime-intervencion');
        const contenedorParo = document.querySelector('.datetime-paro');
        if (contenedorIntervencion) contenedorIntervencion.style.display = 'grid';
        if (contenedorParo) contenedorParo.style.display = 'grid';

        // Aplicar lógica inicial
        syncFieldsByTipoMantenimiento();

    } catch (err) {
        console.error(err);
        if (window.Swal) {
            await Swal.fire({
                icon: 'error',
                title: 'No se pudo guardar',
                text: err.message || 'Intenta de nuevo',
                confirmButtonColor: '#ed6b07'
            });
        } else {
            alert('Error: ' + (err.message || String(err)));
        }
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset._txt || 'Guardar mantenimiento'; }
    }
}

async function cargarUsuariosMantenimiento() {
    try {
        const data = await gqlFetch(QUERY_USUARIOS_MANTENIMIENTO);
        const usuarios = data?.usuariosMantenimiento || [];

        const sel = document.getElementById('mant-user');
        if (!sel) return;

        sel.innerHTML = '<option value="">Seleccionar usuario</option>';

        usuarios.forEach(usuario => {
            const opt = document.createElement('option');
            opt.value = usuario.nombre;
            opt.textContent = usuario.nombre;
            opt.dataset.cedula = usuario.cedula || '';
            sel.appendChild(opt);
        });
    } catch (error) {
        console.error('Error al cargar usuarios de mantenimiento:', error);
        const sel = document.getElementById('mant-user');
        if (sel) sel.innerHTML = '<option value="">Error cargando usuarios</option>';
    }
}

async function cargarTiposMantenimiento() {
    try {
        const data = await gqlFetch(QUERY_TIPOS_MANTENIMIENTO);
        const tipos = data?.tiposMantenimiento || [];

        const sel = document.getElementById('mant-tipo-mantenimiento');
        if (!sel) return;

        sel.innerHTML = '<option value="">Seleccionar tipo</option>';

        tipos.forEach(tipo => {
            const opt = document.createElement('option');
            opt.value = tipo.tipo.toLowerCase();
            opt.textContent = tipo.tipo;
            sel.appendChild(opt);
        });
    } catch (error) {
        console.error('Error al cargar tipos de mantenimiento:', error);
        const sel = document.getElementById('mant-tipo-mantenimiento');
        if (sel) sel.innerHTML = '<option value="">Error cargando tipos</option>';
    }
}

async function cargarTiposMaquina() {
    const data = await GQL(`query { tiposMaquina { id maquina } }`);
    const sel = document.getElementById('mant-tipo-maquina');
    if (!sel) return;

    sel.innerHTML = `<option value="">Seleccionar tipo</option>`;

    const vistos = new Set();
    (data?.tiposMaquina || []).forEach(t => {
        if (!vistos.has(t.maquina)) {
            vistos.add(t.maquina);
            const opt = document.createElement('option');
            opt.value = t.maquina;
            opt.textContent = t.maquina;
            sel.appendChild(opt);
        }
    });

    sel.disabled = false;
}

const MAX_REPUESTOS = 20;

document.getElementById('add-repuesto').onclick = function () {
    const div = document.getElementById('mant-repuestos-list');
    const actuales = div.querySelectorAll('.mant-repuesto').length;
    if (actuales >= MAX_REPUESTOS) {
        if (window.Swal) {
            Swal.fire({
                icon: 'warning',
                title: 'Límite alcanzado',
                text: `Solo puedes agregar hasta ${MAX_REPUESTOS} repuestos.`,
                confirmButtonColor: '#ed6b07'
            });
        } else {
            alert(`Solo puedes agregar hasta ${MAX_REPUESTOS} repuestos.`);
        }
        return;
    }
    // Crea un contenedor para el input y el botón
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '8px';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'mant-repuesto';
    input.placeholder = 'Repuesto usado';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Eliminar';
    btn.style.background = '#c23e3e';
    btn.style.width = '100px';
    btn.style.height = '35px';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.padding = '6px 12px';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '15px'
    btn.style.borderRadius = '5px';
    btn.onclick = function () {
        wrapper.remove();
    };

    wrapper.appendChild(input);
    wrapper.appendChild(btn);
    div.appendChild(wrapper);
};

// Función para obtener los repuestos como array
function getRepuestos() {
    return Array.from(document.querySelectorAll('.mant-repuesto'))
        .map(i => i.value.trim())
        .filter(v => v);
}

function init() {
    // Establecer fechas por defecto (YYYY-MM-DD de hoy)
    const setDefaultDate = (id) => {
        const el = document.getElementById(id);
        if (el && !el.value) {
            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            el.value = `${year}-${month}-${day}`;
        }
    };

    setDefaultDate('mant-fecha-intervencion-inicio');
    setDefaultDate('mant-fecha-intervencion-final');
    setDefaultDate('mant-fecha-paro-inicio');
    setDefaultDate('mant-fecha-paro-final');

    document.getElementById('mant-guardar')?.addEventListener('click', guardar);

    // Cargar datos desde la base de datos
    cargarUsuariosMantenimiento().catch(err => {
        console.error(err);
    });

    cargarTiposMantenimiento().catch(err => {
        console.error(err);
    });

    cargarTiposMaquina().catch(err => {
        console.error(err);
        const sel = document.getElementById('mant-tipo-maquina');
        if (sel) sel.innerHTML = `<option value="">Error cargando tipos</option>`;
    });

    document.getElementById('mant-form')?.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && ev.target?.tagName !== 'TEXTAREA') {
            ev.preventDefault();
        }
    });

    // Event listener para tipo de mantenimiento (controla todo)
    document.getElementById('mant-tipo-mantenimiento')?.addEventListener('change', syncFieldsByTipoMantenimiento);

    // Event listener para paro de máquina (solo actúa en predictivo e inspección)
    document.getElementById('mant-paro')?.addEventListener('change', syncHorasByParo);

    // Event listeners para modo espejo bidireccional en tiempo real
    const allFields = [
        'mant-fecha-intervencion-inicio',
        'mant-hora-intervencion-inicio',
        'mant-fecha-intervencion-final',
        'mant-hora-intervencion-final',
        'mant-fecha-paro-inicio',
        'mant-hora-paro-inicio',
        'mant-fecha-paro-final',
        'mant-hora-paro-final'
    ];

    allFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            // Usar 'input' para que se ejecute en tiempo real mientras escribe
            field.addEventListener('input', mirrorFields);
            // También usar 'change' por si acaso
            field.addEventListener('change', mirrorFields);
        }
    });

    // Inicializar estado
    syncFieldsByTipoMantenimiento();

}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
