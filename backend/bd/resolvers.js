import e from 'cors';
import { GraphQLScalarType, Kind } from 'graphql';

// ===============================================
// CONSTANTES Y CONFIGURACIÓN
// ===============================================

const FORMULARIO_TABLE = 'tablas_servicios."T_Hist_Formulario"';
const MAQUINA_TABLE = 'public."T_Dim_Maquinas"';
const ACTIVIDAD_TABLE = 'public."T_Dim_Actividad"';
const MATERIAL_TABLE = 'public."T_Dim_Material"';
const OBSERVACIONES_TABLE = 'public."T_Dim_Observaciones"';
const USUARIO_MANTENIMIENTO_TABLE = 'public."T_Dim_UsuarioMantenimiento"';
const TIPO_MANTENIMIENTO_TABLE = 'public."T_Dim_TipoMantenimiento"';
const OP_TABLE = 'tablas_servicios."T_Ctrol_OP"';
const PARO_TABLE = 'tablas_servicios."T_Hist_Paro"';
const INTERVENCION_TABLE = 'tablas_servicios."T_Hist_Intervencion"';


export const resolvers = {
  // ===============================================
  // SCALAR PERSONALIZADO (del admin)
  // ===============================================
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Fecha en formato ISO (YYYY-MM-DD)',
    serialize(value) {
      // Devuelve el string tal cual
      return typeof value === 'string' ? value : (
        value instanceof Date ? value.toISOString().split('T')[0] : null
      );
    },
    parseValue(value) {
      // Solo acepta strings en formato YYYY-MM-DD
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
    },
    parseLiteral(ast) {
      return ast.kind === Kind.STRING && /^\d{4}-\d{2}-\d{2}$/.test(ast.value) ? ast.value : null;
    },
  }),

  // ===============================================
  // QUERIES UNIFICADAS
  // ===============================================
  Query: {
    // --- Queries del Formulario (autocompletados) ---
    actividades: async (_, { search, limit = 100, offset = 0 }, { query }) => {
      const params = [];
      let where = '';
      if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        where = `WHERE "actividad" ILIKE $${params.length}`;
      }
      params.push(limit, offset);
      const { rows } = await query(
        `SELECT "id", "actividad" FROM ${ACTIVIDAD_TABLE} ${where} ORDER BY "actividad" ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    },

    actividad: async (_, { id }, { query }) => {
      const { rows } = await query(`SELECT "id", "actividad" FROM ${ACTIVIDAD_TABLE} WHERE "id" = $1`, [id]);
      return rows[0] || null;
    },

    totalActividades: async (_, { search }, { query }) => {
      const params = [];
      let where = '';
      if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        where = `WHERE "actividad" ILIKE $${params.length}`;
      }
      const { rows } = await query(`SELECT COUNT(*)::int AS total FROM ${ACTIVIDAD_TABLE} ${where}`, params);
      return rows[0]?.total ?? 0;
    },

    buscarOperariosPorIdent: async (_, { prefix, limit = 10 }, { query }) => {
      const { rows } = await query(
        `SELECT DISTINCT ON ("Identificacion") CAST("Identificacion" AS TEXT) AS identificacion, "Nombres" AS nombre 
         FROM ${MATERIAL_TABLE} 
         WHERE TRIM("Area") = 'Operaciones' AND CAST("Identificacion" AS TEXT) LIKE $1 
         ORDER BY "Identificacion" ASC LIMIT $2`,
        [`${String(prefix)}%`, limit]
      );
      return rows;
    },

    operarioPorIdent: async (_, { ident }, { query }) => {
      const { rows } = await query(
        `SELECT CAST("Identificacion" AS TEXT) AS identificacion, "Nombres" AS nombre 
         FROM ${MATERIAL_TABLE} 
         WHERE TRIM("Area") = 'Operaciones' AND CAST("Identificacion" AS TEXT) = $1 LIMIT 1`,
        [String(ident)]
      );
      return rows[0] || null;
    },

    observaciones: async (_, { search, limit = 100, offset = 0 }, { query }) => {
      const params = [];
      let where = '';
      if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        where = `WHERE "observaciones" ILIKE $${params.length}`;
      }
      params.push(limit, offset);
      const { rows } = await query(
        `SELECT "id", "observaciones" FROM ${OBSERVACIONES_TABLE} ${where} ORDER BY "observaciones" ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return rows;
    },

    // --- Queries del Admin (lista principal y detalles) ---
    formularios: async (_p, { limit = 50, offset = 0, q, dateFrom, dateTo, id, no_op, sede }, { query2: query }) => {

      const lim = Math.min(Math.max(limit, 1), 500);
      const off = Math.max(offset, 0);
      const where = [];
      const params = [];
      if (sede && sede.trim()) {
        params.push(sede.trim()); // <-- ¡OJO! No usar '%' si quieres una coincidencia exacta
        where.push(`"sede" = $${params.length}`); // <-- Usar '=' para coincidencia exacta
      }
      if (id && id.trim()) { params.push(`%${id.trim()}%`); where.push(`"id"::text ILIKE $${params.length}`); }
      if (no_op && no_op.trim()) { params.push(`%${no_op.trim()}%`); where.push(`"no_op" ILIKE $${params.length}`); }
      if (q && q.trim()) {
        const searchTerms = q.trim().split(/\s+/);
        const nameConditions = searchTerms.map(term => {
          params.push(`%${term}%`);
          return `"nombres" ILIKE $${params.length}`;
        }).join(' AND ');
        params.push(`%${q.trim()}%`);
        where.push(`((${nameConditions}) OR "cc"::text ILIKE $${params.length})`);
      }
      const from = (dateFrom && dateFrom.trim()) ? dateFrom.trim() : null;
      const to = (dateTo && dateTo.trim()) ? dateTo.trim() : null;

      if (from && to) {
        if (from === to) {
          // un solo día: usa igualdad por fecha_inicio
          params.push(from);
          where.push(`"fecha_inicio"::date = $${params.length}::date`);
        } else {
          const a = from <= to ? from : to;
          const b = from <= to ? to : from;
          params.push(a, b);
          where.push(`("fecha_inicio"::date >= $${params.length - 1}::date AND "fecha_final"::date <= $${params.length}::date)`);
        }
      } else if (from) {
        params.push(from);
        where.push(`"fecha_inicio"::date >= $${params.length}::date`);
      } else if (to) {
        params.push(to);
        where.push(`"fecha_final"::date <= $${params.length}::date`);
      }
      const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

      let orderBySQL = 'ORDER BY "id" DESC';
      if (from || to) {
        // Si hay filtro de fecha, cambia el orden
        orderBySQL = 'ORDER BY "nombres" ASC, "fecha_inicio" ASC';
      }

      const totalSql = `SELECT COUNT(*)::int AS total FROM ${FORMULARIO_TABLE} ${whereSQL};`;
      const { rows: trows } = await query(totalSql, params);
      const total = trows[0]?.total ?? 0;
      const limitIndex = params.length + 1;
      const offsetIndex = params.length + 2;
      const dataSql = `SELECT * FROM ${FORMULARIO_TABLE} ${whereSQL} ${orderBySQL} LIMIT $${limitIndex} OFFSET $${offsetIndex};`;
      const { rows } = await query(dataSql, [...params, lim, off]);
      return { items: rows, count: rows.length, total };



    },

    // AJUSTADO: Ahora busca por 'id' como definimos en el schema unificado.
    formulario: async (_p, { id }, { query2: query }) => {
      const { rows } = await query(`SELECT * FROM ${FORMULARIO_TABLE} WHERE "id" = $1 LIMIT 1;`, [id]);
      return rows[0] || null;
    },

    // --- Queries Compartidas (Se usa la versión del Admin que ataca la BD) ---
    buscarOpsExcel: async (_p, { prefix, limit = 10 }, { query2 }) => {
      const { rows } = await query2(`SELECT DISTINCT "O.P." AS op FROM ${OP_TABLE} WHERE "O.P." ILIKE $1 ORDER BY "O.P." ASC LIMIT $2`, [`${prefix}%`, limit]);
      return rows.map(r => r.op);
    },

    buscarSciPorOp: async (_p, { op, prefix = '', limit = 10 }, { query2 }) => {
      const params = [op];
      let where = `WHERE "O.P." = $1`;
      if (prefix && prefix.trim()) {
        params.push(`${prefix.trim()}%`);
        where += ` AND CAST("SCI Ref." AS TEXT) ILIKE $${params.length}`;
      }
      params.push(limit);
      const { rows } = await query2(`SELECT "SCI Ref."::text AS sci FROM ${OP_TABLE} ${where} GROUP BY "SCI Ref." ORDER BY "SCI Ref." ASC LIMIT $${params.length}`, params);
      return rows.map(r => r.sci);
    },

    refPorOpSci: async (_p, { op, sci }, { query2 }) => {
      const { rows } = await query2(`SELECT "O.P." AS op, "SCI Ref."::text AS sci, "Descripción Referencia" AS descripcion FROM ${OP_TABLE} WHERE "O.P." = $1 AND CAST("SCI Ref." AS TEXT) = $2 LIMIT 1`, [op, String(sci)]);
      return rows[0] || null;
    },

    ctpnList: async (_p, _a, { query }) => {
      const { rows } = await query(`SELECT DISTINCT "ct_pn" as area FROM ${MAQUINA_TABLE} ORDER BY "ct_pn" ASC`);
      return rows.map(r => r.area);
    },

    maquinasPorCtpn: async (_, { ctpn }, { query }) => {
      const { rows } = await query(`SELECT "id", "ct_pn", "maquina" FROM ${MAQUINA_TABLE} WHERE "ct_pn" = $1 ORDER BY "maquina" ASC`, [ctpn]);
      return rows;
    },

    sedesDisponibles: async (_, __, { query2: query }) => {
      const sql = `
            SELECT DISTINCT "sede"
            FROM ${FORMULARIO_TABLE}
            WHERE "sede" IS NOT NULL AND "sede" <> ''
            ORDER BY "sede" ASC;
        `;
      const { rows } = await query(sql);
      return rows.map(row => row.sede);
    },
    tiposMaquina: async (_, __, { query }) => {
      const { rows } = await query(
        `SELECT DISTINCT id, maquina FROM ${MAQUINA_TABLE} ORDER BY maquina ASC`
      );
      return rows;
    },

    usuariosMantenimiento: async (_, __, { query }) => {
      const { rows } = await query(
        `SELECT id, nombre, cedula FROM ${USUARIO_MANTENIMIENTO_TABLE} ORDER BY nombre ASC`
      );
      return rows;
    },

    tiposMantenimiento: async (_, __, { query }) => {
      const { rows } = await query(
        `SELECT id, tipo FROM ${TIPO_MANTENIMIENTO_TABLE} ORDER BY tipo ASC`
      );
      return rows;
    },

    paros: async (_, { limit = 50, offset = 0, estado }, { query2 }) => {
      const params = [];
      let where = '';

      if (estado) {
        params.push(estado);
        where = `WHERE estado = $${params.length}`;
      }

      params.push(limit, offset);
      const sql = `
        SELECT id, usuario, cedula, tipo_maquina, paro_maquina,
               fecha_paro_inicio, hora_paro_inicio, fecha_paro_final, hora_paro_final,
               estado,
               TO_CHAR(fecha_registro, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_registro
        FROM ${PARO_TABLE}
        ${where}
        ORDER BY fecha_registro DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;

      const { rows } = await query2(sql, params);
      return rows;
    },

    paro: async (_, { id }, { query2 }) => {
      const { rows } = await query2(
        `SELECT * FROM ${PARO_TABLE} WHERE id = $1`,
        [id]
      );
      return rows[0] || null;
    },

    intervencionesDelParo: async (_, { id_paro }, { query2 }) => {
      const { rows } = await query2(
        `SELECT id, id_paro, tipo_mantenimiento, observacion, repuesto,
                usuario_intervencion, cedula_intervencion,
                fecha_intervencion_inicio, hora_intervencion_inicio,
                fecha_intervencion_final, hora_intervencion_final,
                TO_CHAR(fecha_registro, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_registro
         FROM ${INTERVENCION_TABLE}
         WHERE id_paro = $1
         ORDER BY fecha_registro ASC`,
        [id_paro]
      );
      return rows;
    },
  },

  // ===============================================
  // RESOLVERS DE CAMPOS COMPUTADOS
  // ===============================================
  Paro: {
    intervenciones: async (parent, _, { query2 }) => {
      const { rows } = await query2(
        `SELECT id, id_paro, tipo_mantenimiento, observacion, repuesto,
                usuario_intervencion, cedula_intervencion,
                fecha_intervencion_inicio, hora_intervencion_inicio,
                fecha_intervencion_final, hora_intervencion_final,
                TO_CHAR(fecha_registro, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_registro
         FROM ${INTERVENCION_TABLE}
         WHERE id_paro = $1
         ORDER BY fecha_registro ASC`,
        [parent.id]
      );
      return rows;
    },
  },

  // ===============================================
  // MUTATIONS UNIFICADAS
  // ===============================================
  Mutation: {
    // --- Mutation del Formulario ---
    crear_formulario: async (_, { input }, { query2: query }) => {

      const normalizeForCheck = (s) => String(s ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const isNA = (v) => { const t = String(v ?? '').trim(); if (!t) return true; const n = normalizeForCheck(t); return n === 'n/a' || n.startsWith('seleccione'); };
      const textFinal = (v) => (isNA(v) ? 'N/A' : String(v).trim());
      const numFinal = (v) => { if (v === null || v === undefined) return 0; const s = String(v).replace(',', '.').trim(); if (!s) return 0; const n = Number(s); return Number.isFinite(n) ? n : 0; };
      const dateFinal = (v) => { const s = String(v ?? '').trim(); return s || null; };
      const timeFinal = (v) => { const s = String(v ?? '').trim(); return s || null; };
      const ccRaw = String(input.cc ?? '').trim();
      const ccFinal = /^\d+$/.test(ccRaw) ? ccRaw : null;
      const row = {
        cc: ccFinal, nombres: textFinal(input.nombres), sede: textFinal(input.sede), no_op: textFinal(input.no_op), sci_ref: textFinal(input.sci_ref),
        descripcion_ref: textFinal(input.descripcion_referencia), fecha_inicio: dateFinal(input.fecha_inicio), hora_inicio: timeFinal(input.hora_inicio),
        fecha_final: dateFinal(input.fecha_final), hora_final: timeFinal(input.hora_final), actividad: textFinal(input.actividad), cantidad: numFinal(input.cantidad),
        estado_sci: textFinal(input.estado_sci), area: textFinal(input.area), maquina: textFinal(input.maquina), horario: textFinal(input.horario),
        observaciones: textFinal(input.observaciones), tiempo_fallo_minutos: input.observaciones === 'Fallo de maquina' ? Number(input.tiempo_fallo_minutos) : 0
      };

      const sql = `INSERT INTO ${FORMULARIO_TABLE} ("cc","nombres","sede","no_op","sci_ref","descripcion_referencia","fecha_inicio","hora_inicio","fecha_final","hora_final","actividad","cantidad","estado_sci","area","maquina","horario","observaciones", "tiempo_fallo_minutos") VALUES ($1::bigint, $2, $3, $4, $5, $6, $7::date, $8::time, $9::date, $10::time, $11, $12::numeric, $13, $14, $15, $16, $17, $18) RETURNING *, "tiempo_fallo_minutos",TO_CHAR(NOW(),'YYYY-MM-DD"T"HH24:MI:SS') AS created_at, CAST("cc" AS TEXT) AS cc`;
      const params = [
        row.cc, row.nombres, row.sede, row.no_op, row.sci_ref, row.descripcion_ref, row.fecha_inicio, row.hora_inicio, row.fecha_final, row.hora_final,
        row.actividad, row.cantidad, row.estado_sci, row.area, row.maquina, row.horario, row.observaciones, row.tiempo_fallo_minutos
      ];
      const { rows } = await query(sql, params);
      return rows[0];
    },

    // --- Mutations del Admin ---
    updateFormulario: async (_p, { id, patch }, { query2: query }) => {

      const fields = [];
      const params = [];
      const push = (col, val, cast = '') => { params.push(val); fields.push(`"${col}" = $${params.length}${cast}`); };
      Object.keys(patch).forEach(key => {
        if (patch[key] != null) {
          if (key === 'fecha_inicio' || key === 'fecha_final') push(key, String(patch[key]), '::date');
          else if (key === 'hora_inicio' || key === 'hora_final') push(key, String(patch[key]), '::time');
          else if (key === 'cantidad') push(key, Number(patch[key]));
          else push(key, String(patch[key]));
        }
      });
      if (!fields.length) {
        const { rows } = await query(`SELECT * FROM ${FORMULARIO_TABLE} WHERE "id"=$1 LIMIT 1`, [Number(id)]);
        return rows[0] || null;
      }
      params.push(Number(id));
      const sql = `UPDATE ${FORMULARIO_TABLE} SET ${fields.join(', ')} WHERE "id" = $${params.length} RETURNING *`;
      const { rows } = await query(sql, params);
      return rows[0] || null;
    },

    updateMultiplesFormularios: async (_p, { updates }, { query2: query }) => {
      await query('BEGIN');
      try {
        for (const update of updates) {
          const { id, patch } = update;
          const fields = [];
          const params = [];
          const push = (col, val, cast = '') => { params.push(val); fields.push(`"${col}" = $${params.length}${cast}`); };
          Object.keys(patch).forEach(key => {
            if (patch[key] != null) {
              if (key === 'fecha_inicio' || key === 'fecha_final') push(key, String(patch[key]), '::date');
              else if (key === 'hora_inicio' || key === 'hora_final') push(key, String(patch[key]), '::time');
              else if (key === 'cantidad') push(key, Number(patch[key]));
              else push(key, String(patch[key]));
            }
          });
          if (fields.length > 0) {
            params.push(Number(id));
            const sql = `UPDATE ${FORMULARIO_TABLE} SET ${fields.join(', ')} WHERE "id" = $${params.length}`;
            await query(sql, params);
          }
        }
        await query('COMMIT');
        return true;
      } catch (e) {
        await query('ROLLBACK');
        console.error("Error en guardado múltiple, revirtiendo cambios:", e);
        throw e;
      }
    },

    deleteFormulario: async (_, { id }, { query2: query }) => {
      const sql = `
        DELETE FROM ${FORMULARIO_TABLE}
        WHERE "id" = $1
        RETURNING *;
      `;
      const { rows } = await query(sql, [id]);
      // Devuelve el primer (y único) registro eliminado, o null si no se encontró
      return rows[0] || null;
    },

    login: async (_, { username, password }) => {

      const { default: bcrypt } = await import('bcryptjs');

      const validUser = username === process.env.ADMIN_USER;
      const validPass = validUser && await bcrypt.compare(password, process.env.ADMIN_PASS_HASH);

      if (validUser && validPass) {
        return "fake-auth-token-" + Date.now();
      } else {
        throw new Error("Usuario o contraseña incorrectos.");
      }
    },


    crearParoConIntervencion: async (_, { paro, intervencion }, { query2 }) => {
      await query2('BEGIN');

      try {
        const text = v => String(v ?? '').trim();
        const dateToString = (v) => {
          if (!v) return null;
          const dateStr = String(v).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
          const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
          if (match) return match[1];
          try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            }
          } catch (e) {
            console.error('Error parsing date:', e);
          }
          return null;
        };
        const timeToString = (v) => {
          if (!v) return null;
          const timeStr = String(v).trim();
          if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) return timeStr;
          return null;
        };

        // Procesar datos del paro
        const paroData = {
          usuario: text(paro.usuario),
          cedula: Number(paro.cedula) || null,
          tipo_maquina: text(paro.tipo_maquina),
          paro_maquina: text(paro.paro_maquina),
          fecha_paro_inicio: dateToString(paro.fecha_paro_inicio),
          hora_paro_inicio: timeToString(paro.hora_paro_inicio),
          fecha_paro_final: dateToString(paro.fecha_paro_final),
          hora_paro_final: timeToString(paro.hora_paro_final),
          estado: text(paro.estado) || 'continuidad',
        };

        // Insertar paro
        const paroSql = `
          INSERT INTO ${PARO_TABLE}
          (usuario, cedula, tipo_maquina, paro_maquina,
           fecha_paro_inicio, hora_paro_inicio, fecha_paro_final, hora_paro_final, estado)
          VALUES ($1, $2, $3, $4, $5::date, $6::time, $7::date, $8::time, $9)
          RETURNING *
        `;
        const { rows: paroRows } = await query2(paroSql, [
          paroData.usuario, paroData.cedula, paroData.tipo_maquina, paroData.paro_maquina,
          paroData.fecha_paro_inicio, paroData.hora_paro_inicio,
          paroData.fecha_paro_final, paroData.hora_paro_final, paroData.estado
        ]);

        const nuevoParo = paroRows[0];

        // Procesar datos de la intervención
        const intervencionData = {
          tipo_mantenimiento: text(intervencion.tipo_mantenimiento),
          observacion: text(intervencion.observacion),
          repuesto: Array.isArray(intervencion.repuesto) ? intervencion.repuesto : [],
          usuario_intervencion: text(intervencion.usuario_intervencion),
          cedula_intervencion: intervencion.cedula_intervencion,
          fecha_intervencion_inicio: dateToString(intervencion.fecha_intervencion_inicio),
          hora_intervencion_inicio: timeToString(intervencion.hora_intervencion_inicio),
          fecha_intervencion_final: dateToString(intervencion.fecha_intervencion_final),
          hora_intervencion_final: timeToString(intervencion.hora_intervencion_final),
        };

        // Insertar intervención vinculada
        const intervencionSql = `
          INSERT INTO ${INTERVENCION_TABLE}
          (id_paro, tipo_mantenimiento, observacion, repuesto,
           usuario_intervencion, cedula_intervencion,
           fecha_intervencion_inicio, hora_intervencion_inicio,
           fecha_intervencion_final, hora_intervencion_final)
          VALUES ($1, $2, $3, $4::text[], $5, $6, $7::date, $8::time, $9::date, $10::time)
          RETURNING *
        `;
        await query2(intervencionSql, [
          nuevoParo.id,
          intervencionData.tipo_mantenimiento, intervencionData.observacion, intervencionData.repuesto,
          intervencionData.usuario_intervencion, intervencionData.cedula_intervencion,
          intervencionData.fecha_intervencion_inicio, intervencionData.hora_intervencion_inicio,
          intervencionData.fecha_intervencion_final, intervencionData.hora_intervencion_final
        ]);

        await query2('COMMIT');
        return nuevoParo;

      } catch (error) {
        await query2('ROLLBACK');
        console.error("Error al crear paro con intervención:", error);
        throw new Error(`Error al guardar: ${error.message}`);
      }
    },

    agregarIntervencion: async (_, { id_paro, intervencion }, { query2 }) => {
      // Primero verificar que el paro exista y no esté finalizado
      const { rows: paroRows } = await query2(
        `SELECT estado FROM ${PARO_TABLE} WHERE id = $1`,
        [id_paro]
      );

      if (!paroRows || paroRows.length === 0) {
        throw new Error('El paro especificado no existe');
      }

      if (paroRows[0].estado === 'finalizado') {
        throw new Error('No se pueden agregar intervenciones a un paro finalizado');
      }

      const text = v => String(v ?? '').trim();
      const dateToString = (v) => {
        if (!v) return null;
        const dateStr = String(v).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        return null;
      };
      const timeToString = (v) => {
        if (!v) return null;
        const timeStr = String(v).trim();
        if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) return timeStr;
        return null;
      };

      const intervencionData = {
        tipo_mantenimiento: text(intervencion.tipo_mantenimiento),
        observacion: text(intervencion.observacion),
        repuesto: Array.isArray(intervencion.repuesto) ? intervencion.repuesto : [],
        usuario_intervencion: text(intervencion.usuario_intervencion),
        cedula_intervencion: intervencion.cedula_intervencion,
        fecha_intervencion_inicio: dateToString(intervencion.fecha_intervencion_inicio),
        hora_intervencion_inicio: timeToString(intervencion.hora_intervencion_inicio),
        fecha_intervencion_final: dateToString(intervencion.fecha_intervencion_final),
        hora_intervencion_final: timeToString(intervencion.hora_intervencion_final),
      };

      const sql = `
        INSERT INTO ${INTERVENCION_TABLE}
        (id_paro, tipo_mantenimiento, observacion, repuesto,
         usuario_intervencion, cedula_intervencion,
         fecha_intervencion_inicio, hora_intervencion_inicio,
         fecha_intervencion_final, hora_intervencion_final)
        VALUES ($1, $2, $3, $4::text[], $5, $6, $7::date, $8::time, $9::date, $10::time)
        RETURNING *
      `;

      const { rows } = await query2(sql, [
        id_paro,
        intervencionData.tipo_mantenimiento, intervencionData.observacion, intervencionData.repuesto,
        intervencionData.usuario_intervencion, intervencionData.cedula_intervencion,
        intervencionData.fecha_intervencion_inicio, intervencionData.hora_intervencion_inicio,
        intervencionData.fecha_intervencion_final, intervencionData.hora_intervencion_final
      ]);

      return rows[0];
    },

    actualizarEstadoParo: async (_, { id, estado }, { query2 }) => {
      const sql = `
        UPDATE ${PARO_TABLE}
        SET estado = $1
        WHERE id = $2
        RETURNING *
      `;

      const { rows } = await query2(sql, [estado, id]);
      return rows[0] || null;
    },

    eliminarIntervencion: async (_, { id }, { query2 }) => {
      const sql = `
        DELETE FROM ${INTERVENCION_TABLE}
        WHERE id = $1
        RETURNING *
      `;

      const { rows } = await query2(sql, [id]);
      return rows[0] || null;
    },
  },
};