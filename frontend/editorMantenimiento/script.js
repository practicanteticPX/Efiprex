// ============================================
// GRAPHQL FETCH
// ============================================
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

// ============================================
// FORMATEAR FECHA (TIMESTAMP)
// ============================================
function formatearFecha(fecha) {
    if (!fecha) return 'N/A';

    try {
        const d = new Date(fecha);
        if (isNaN(d.getTime())) return 'N/A';

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
        console.error('Error formateando fecha:', fecha, error);
        return 'N/A';
    }
}

// ============================================
// QUERIES
// ============================================
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

const QUERY_PAROS = `
query {
  paros {
    id
    usuario
    cedula
    tipo_maquina
    paro_maquina
    fecha_paro_inicio
    hora_paro_inicio
    fecha_paro_final
    hora_paro_final
    estado
    fecha_registro
  }
}
`;

const QUERY_INTERVENCIONES = `
query IntervencionesDelParo($id_paro: ID!) {
  intervencionesDelParo(id_paro: $id_paro) {
    id
    tipo_mantenimiento
    observacion
    repuesto
    usuario_intervencion
    cedula_intervencion
    fecha_intervencion_inicio
    hora_intervencion_inicio
    fecha_intervencion_final
    hora_intervencion_final
    fecha_registro
  }
  paro(id: $id_paro) {
    fecha_paro_inicio
    hora_paro_inicio
    fecha_paro_final
    hora_paro_final
    tipo_maquina
    usuario
    estado
  }
}
`;

const MUTATION_AGREGAR_INTERVENCION = `
mutation AgregarIntervencion($id_paro: ID!, $intervencion: IntervencionInput!) {
  agregarIntervencion(id_paro: $id_paro, intervencion: $intervencion) {
    id
    tipo_mantenimiento
    fecha_registro
  }
}
`;

const MUTATION_ACTUALIZAR_ESTADO = `
mutation ActualizarEstadoParo($id: ID!, $estado: String!) {
  actualizarEstadoParo(id: $id, estado: $estado) {
    id
    estado
  }
}
`;

const MUTATION_ELIMINAR_INTERVENCION = `
mutation EliminarIntervencion($id: ID!) {
  eliminarIntervencion(id: $id) {
    id
    tipo_mantenimiento
  }
}
`;

// ============================================
// CARGAR USUARIOS Y TIPOS DE MANTENIMIENTO
// ============================================
async function cargarUsuariosMantenimiento() {
    try {
        const data = await gqlFetch(QUERY_USUARIOS_MANTENIMIENTO);
        const usuarios = data?.usuariosMantenimiento || [];

        const select = document.getElementById('add-usuario');
        if (!select) return;

        // Limpiar opciones existentes excepto la primera (placeholder)
        select.innerHTML = '<option value="">Seleccionar usuario</option>';

        // Agregar opciones dinámicamente
        usuarios.forEach(usuario => {
            const option = document.createElement('option');
            option.value = usuario.nombre;
            option.textContent = usuario.nombre;
            option.dataset.cedula = usuario.cedula || '';
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar usuarios de mantenimiento:', error);
    }
}

async function cargarTiposMantenimiento() {
    try {
        const data = await gqlFetch(QUERY_TIPOS_MANTENIMIENTO);
        const tipos = data?.tiposMantenimiento || [];

        const select = document.getElementById('add-tipo-mantenimiento');
        if (!select) return;

        // Limpiar opciones existentes excepto la primera (placeholder)
        select.innerHTML = '<option value="">Seleccionar</option>';

        // Agregar opciones dinámicamente
        tipos.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.tipo;
            option.textContent = tipo.tipo;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar tipos de mantenimiento:', error);
    }
}

// ============================================
// CARGAR PAROS
// ============================================
async function cargarParos() {
    const tbody = document.getElementById('tabla-paros-body');
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Cargando paros...</td></tr>';

    try {
        const data = await gqlFetch(QUERY_PAROS);
        const paros = data?.paros || [];

        if (paros.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="loading">No hay paros registrados</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        paros.forEach(paro => {
            const tr = document.createElement('tr');
            tr.className = 'paro-row';

            const estadoClass = paro.estado === 'finalizado' ? 'badge-finalizado' : 'badge-continuidad';
            const estadoBadge = `<span class="badge-estado ${estadoClass}">${paro.estado || 'continuidad'}</span>`;

            tr.innerHTML = `
                <td>${paro.id}</td>
                <td>${paro.usuario || 'N/A'}</td>
                <td>${paro.cedula || 'N/A'}</td>
                <td>${paro.tipo_maquina || 'N/A'}</td>
                <td>${paro.paro_maquina || 'N/A'}</td>
                <td>${paro.fecha_paro_inicio || 'N/A'}</td>
                <td>${paro.hora_paro_inicio || 'N/A'}</td>
                <td>${paro.fecha_paro_final || 'N/A'}</td>
                <td>${paro.hora_paro_final || 'N/A'}</td>
                <td>${estadoBadge}</td>
                <td>${formatearFecha(paro.fecha_registro)}</td>
                <td>
                    <button class="btn-ver" onclick="verIntervenciones(${paro.id})">Ver Intervenciones</button>
                    <button class="btn-estado" onclick="cambiarEstado(${paro.id}, '${paro.estado}')">Cambiar Estado</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error al cargar paros:', error);
        tbody.innerHTML = `<tr><td colspan="10" class="loading" style="color: #ef4444;">Error: ${error.message}</td></tr>`;
    }
}

// ============================================
// VER INTERVENCIONES DE UN PARO
// ============================================
let idParoActual = null;
let datosParo = null;

async function verIntervenciones(id_paro) {
    idParoActual = id_paro;

    const modal = document.getElementById('modal-intervenciones');
    const tbody = document.getElementById('tabla-intervenciones-body');
    const infoParo = document.getElementById('info-paro');

    tbody.innerHTML = '<tr><td colspan="10" class="loading">Cargando intervenciones...</td></tr>';
    modal.style.display = 'flex';

    try {
        const data = await gqlFetch(QUERY_INTERVENCIONES, { id_paro: String(id_paro) });
        const intervenciones = data?.intervencionesDelParo || [];
        datosParo = data?.paro || {};

        // Mostrar info del paro con estado
        const estadoBadge = datosParo.estado === 'finalizado'
            ? '<span class="badge-estado badge-finalizado">finalizado</span>'
            : '<span class="badge-estado badge-continuidad">continuidad</span>';

        infoParo.innerHTML = `
            <h3>Paro #${id_paro} ${estadoBadge}</h3>
            <p><strong>Usuario:</strong> ${datosParo.usuario || 'N/A'}</p>
            <p><strong>Máquina:</strong> ${datosParo.tipo_maquina || 'N/A'}</p>
            <p><strong>Paro:</strong> ${datosParo.fecha_paro_inicio || 'N/A'} ${datosParo.hora_paro_inicio || ''} - ${datosParo.fecha_paro_final || 'N/A'} ${datosParo.hora_paro_final || ''}</p>
        `;

        // Deshabilitar botón de agregar si está finalizado
        const btnAgregar = document.getElementById('btn-agregar-intervencion');
        if (datosParo.estado === 'finalizado') {
            btnAgregar.disabled = true;
            btnAgregar.style.opacity = '0.5';
            btnAgregar.style.cursor = 'not-allowed';
            btnAgregar.title = 'No se pueden agregar intervenciones a un paro finalizado';
        } else {
            btnAgregar.disabled = false;
            btnAgregar.style.opacity = '1';
            btnAgregar.style.cursor = 'pointer';
            btnAgregar.title = '';
        }

        if (intervenciones.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="loading">No hay intervenciones para este paro</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        intervenciones.forEach(interv => {
            const tr = document.createElement('tr');
            const repuestosText = Array.isArray(interv.repuesto) && interv.repuesto.length > 0
                ? interv.repuesto.join(', ')
                : 'N/A';

            tr.innerHTML = `
                <td>${interv.id}</td>
                <td>${interv.tipo_mantenimiento || 'N/A'}</td>
                <td title="${interv.usuario_intervencion || 'N/A'}">${interv.usuario_intervencion || 'N/A'}</td>
                <td title="${interv.observacion || 'N/A'}">${interv.observacion || 'N/A'}</td>
                <td title="${repuestosText}">${repuestosText}</td>
                <td>${interv.fecha_intervencion_inicio || 'N/A'}</td>
                <td>${interv.hora_intervencion_inicio || 'N/A'}</td>
                <td>${interv.fecha_intervencion_final || 'N/A'}</td>
                <td>${interv.hora_intervencion_final || 'N/A'}</td>
                <td>${formatearFecha(interv.fecha_registro)}</td>
                <td>
                    <button class="btn-eliminar" onclick="eliminarIntervencion(${interv.id})">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error al cargar intervenciones:', error);
        tbody.innerHTML = `<tr><td colspan="11" class="loading" style="color: #ef4444;">Error: ${error.message}</td></tr>`;
    }
}

// ============================================
// CERRAR MODAL
// ============================================
function cerrarModal() {
    document.getElementById('modal-intervenciones').style.display = 'none';
    idParoActual = null;
    datosParo = null;
}

// ABRIR MODAL PARA AGREGAR INTERVENCIÓN
function abrirModalAgregarIntervencion() {
    if (!idParoActual) return;

    // Validar que el paro no esté finalizado
    if (datosParo && datosParo.estado === 'finalizado') {
        Swal.fire({
            icon: 'warning',
            title: 'Paro finalizado',
            text: 'No se pueden agregar intervenciones a un paro finalizado',
            confirmButtonColor: '#0891b2'
        });
        return;
    }

    document.getElementById('modal-agregar').style.display = 'flex';

    // Pre-llenar fechas con las del paro (como referencia)
    if (datosParo) {
        document.getElementById('add-fecha-inicio').value = datosParo.fecha_paro_inicio || '';
        document.getElementById('add-fecha-final').value = datosParo.fecha_paro_final || '';
    }
}

function cerrarModalAgregar() {
    document.getElementById('modal-agregar').style.display = 'none';
    limpiarFormularioAgregar();
}

function limpiarFormularioAgregar() {
    document.getElementById('add-tipo-mantenimiento').value = '';
    document.getElementById('add-observacion').value = '';
    document.getElementById('add-fecha-inicio').value = '';
    document.getElementById('add-hora-inicio').value = '';
    document.getElementById('add-fecha-final').value = '';
    document.getElementById('add-hora-final').value = '';

    // Limpiar repuestos
    const repList = document.getElementById('add-repuestos-list');
    repList.innerHTML = '<input type="text" class="add-repuesto" placeholder="Repuesto usado">';
}

// ============================================
// AGREGAR/ELIMINAR REPUESTOS DINÁMICAMENTE
// ============================================
const MAX_REPUESTOS = 20;

function agregarRepuesto() {
    const div = document.getElementById('add-repuestos-list');
    const actuales = div.querySelectorAll('.add-repuesto').length;

    if (actuales >= MAX_REPUESTOS) {
        Swal.fire({
            icon: 'warning',
            title: 'Límite alcanzado',
            text: `Solo puedes agregar hasta ${MAX_REPUESTOS} repuestos.`,
            confirmButtonColor: '#0891b2'
        });
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '8px';
    wrapper.style.marginTop = '8px';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'add-repuesto';
    input.placeholder = 'Repuesto usado';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Eliminar';
    btn.className = 'btn-eliminar-rep';
    btn.onclick = function () {
        wrapper.remove();
    };

    wrapper.appendChild(input);
    wrapper.appendChild(btn);
    div.appendChild(wrapper);
}

function getRepuestos() {
    return Array.from(document.querySelectorAll('.add-repuesto'))
        .map(i => i.value.trim())
        .filter(v => v);
}

// ============================================
// GUARDAR NUEVA INTERVENCIÓN
// ============================================
async function guardarIntervencion() {
    if (!idParoActual) return;

    const usuario = document.getElementById('add-usuario').value.trim();
    const tipo_mantenimiento = document.getElementById('add-tipo-mantenimiento').value.trim();
    const observacion = document.getElementById('add-observacion').value.trim();
    const fecha_intervencion_inicio = document.getElementById('add-fecha-inicio').value.trim();
    const hora_intervencion_inicio = document.getElementById('add-hora-inicio').value.trim();
    const fecha_intervencion_final = document.getElementById('add-fecha-final').value.trim();
    const hora_intervencion_final = document.getElementById('add-hora-final').value.trim();
    const repuesto = getRepuestos();

    // Validar campos obligatorios
    if (!usuario) {
        Swal.fire({
            icon: 'error',
            title: 'Campos obligatorios',
            text: 'Selecciona un usuario',
            confirmButtonColor: '#0891b2'
        });
        return;
    }

    if (!tipo_mantenimiento) {
        Swal.fire({
            icon: 'error',
            title: 'Campos obligatorios',
            text: 'Completa el tipo de mantenimiento',
            confirmButtonColor: '#0891b2'
        });
        return;
    }

    // Obtener cédula del dataset del usuario seleccionado
    const selectUsuario = document.getElementById('add-usuario');
    const selectedOption = selectUsuario.options[selectUsuario.selectedIndex];
    const cedula = parseInt(selectedOption.dataset.cedula) || 0;

    const intervencion = {
        tipo_mantenimiento,
        observacion,
        repuesto,
        usuario_intervencion: usuario,
        cedula_intervencion: cedula,
        fecha_intervencion_inicio: fecha_intervencion_inicio || null,
        hora_intervencion_inicio: hora_intervencion_inicio || null,
        fecha_intervencion_final: fecha_intervencion_final || null,
        hora_intervencion_final: hora_intervencion_final || null
    };

    try {
        await gqlFetch(MUTATION_AGREGAR_INTERVENCION, {
            id_paro: String(idParoActual),
            intervencion
        });

        Swal.fire({
            icon: 'success',
            title: 'Intervención agregada',
            text: 'La intervención se agregó correctamente',
            confirmButtonColor: '#0891b2'
        });

        cerrarModalAgregar();
        verIntervenciones(idParoActual); // Recargar intervenciones
    } catch (error) {
        console.error('Error al agregar intervención:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo agregar la intervención',
            confirmButtonColor: '#ef4444'
        });
    }
}

// ============================================
// ELIMINAR INTERVENCIÓN
// ============================================
async function eliminarIntervencion(id) {
    const result = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar intervención?',
        text: 'Esta acción no se puede deshacer',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await gqlFetch(MUTATION_ELIMINAR_INTERVENCION, {
                id: String(id)
            });

            Swal.fire({
                icon: 'success',
                title: 'Intervención eliminada',
                text: 'La intervención se eliminó correctamente',
                confirmButtonColor: '#0891b2'
            });

            // Recargar la lista de intervenciones
            if (idParoActual) {
                verIntervenciones(idParoActual);
            }
        } catch (error) {
            console.error('Error al eliminar intervención:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'No se pudo eliminar la intervención',
                confirmButtonColor: '#ef4444'
            });
        }
    }
}

// ============================================
// CAMBIAR ESTADO DEL PARO
// ============================================
async function cambiarEstado(id, estadoActual) {
    const nuevoEstado = estadoActual === 'finalizado' ? 'continuidad' : 'finalizado';

    const result = await Swal.fire({
        icon: 'question',
        title: '¿Cambiar estado?',
        text: `Cambiar de "${estadoActual}" a "${nuevoEstado}"`,
        showCancelButton: true,
        confirmButtonColor: '#0891b2',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, cambiar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await gqlFetch(MUTATION_ACTUALIZAR_ESTADO, {
                id: String(id),
                estado: nuevoEstado
            });

            Swal.fire({
                icon: 'success',
                title: 'Estado actualizado',
                text: `Estado cambiado a "${nuevoEstado}"`,
                confirmButtonColor: '#0891b2'
            });

            cargarParos(); // Recargar lista
        } catch (error) {
            console.error('Error al cambiar estado:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'No se pudo cambiar el estado',
                confirmButtonColor: '#ef4444'
            });
        }
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Cargar datos iniciales
    cargarParos();
    cargarUsuariosMantenimiento();
    cargarTiposMantenimiento();

    // Event listeners para modales
    document.getElementById('btn-cerrar-modal')?.addEventListener('click', cerrarModal);
    document.getElementById('btn-agregar-intervencion')?.addEventListener('click', abrirModalAgregarIntervencion);
    document.getElementById('btn-cerrar-agregar')?.addEventListener('click', cerrarModalAgregar);
    document.getElementById('btn-cancelar-agregar')?.addEventListener('click', cerrarModalAgregar);
    document.getElementById('btn-guardar-intervencion')?.addEventListener('click', guardarIntervencion);
    document.getElementById('btn-add-repuesto')?.addEventListener('click', agregarRepuesto);

    // Cerrar modal al hacer clic fuera - DESHABILITADO
    // Los modales solo se cierran con la X o botón Cancelar
    // window.addEventListener('click', (e) => {
    //     const modalIntervenciones = document.getElementById('modal-intervenciones');
    //     const modalAgregar = document.getElementById('modal-agregar');

    //     if (e.target === modalIntervenciones) {
    //         cerrarModal();
    //     }
    //     if (e.target === modalAgregar) {
    //         cerrarModalAgregar();
    //     }
    // });
});
