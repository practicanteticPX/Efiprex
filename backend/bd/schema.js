export const typeDefs = `
  scalar Date

  type Formulario {
    id: ID!
    cc: String
    nombres: String!
    sede: String
    no_op: String
    sci_ref: String
    descripcion_referencia: String
    fecha_inicio: Date
    hora_inicio: String
    fecha_final: Date
    hora_final: String
    actividad: String
    cantidad: Float
    estado_sci: String
    area: String
    maquina: String
    horario: String
    observaciones: String
    tiempo_fallo_minutos: Int
    created_at: String
  }

  type Actividad {
    id: ID!
    actividad: String!
  }

  type Operario {
    identificacion: ID!
    nombre: String!
  }

  type Observacion {
    id: ID!
    observaciones: String!
  }

  type Maquina {
    id: ID!
    ct_pn: String!
    maquina: String!
  }

  type RefRow {
    op: String!
    sci: String!
    descripcion: String!
  }

  type FormulariosResult {
    items: [Formulario!]!
    count: Int!
    total: Int!
  }

  input FormularioInput {
    cc: String
    nombres: String
    sede: String
    no_op: String
    sci_ref: String
    descripcion_referencia: String
    fecha_inicio: String
    hora_inicio: String
    fecha_final: String
    hora_final: String
    actividad: String
    cantidad: Float
    estado_sci: String
    area: String
    maquina: String
    horario: String
    observaciones: String
    tiempo_fallo_minutos: Int
  }

  input FormularioPatch {
    nombres: String
    actividad: String
    sede: String
    fecha_inicio: String
    fecha_final: String
    hora_inicio: String
    hora_final: String
    no_op: String
    sci_ref: String
    descripcion_referencia: String
    cantidad: Float
    estado_sci: String
    area: String
    maquina: String
    horario: String
    observaciones: String
    tiempo_fallo_minutos: Int
  }

  input FormularioUpdateInput {
    id: ID!
    patch: FormularioPatch!
  }

  type Query {
    actividades(search: String, limit: Int, offset: Int): [Actividad!]!
    actividad(id: ID!): Actividad
    totalActividades(search: String): Int!
    buscarOperariosPorIdent(prefix: String!, limit: Int = 10): [Operario!]!
    operarioPorIdent(ident: ID!): Operario
    observaciones(search: String, limit: Int, offset: Int): [Observacion!]!
    formularios(limit: Int = 50, offset: Int = 0, q: String, dateFrom: String, dateTo: String, id: ID, no_op: String, sede: String): FormulariosResult!
    sedesDisponibles: [String!]!
    formulario(id: ID!): Formulario
    buscarOpsExcel(prefix: String!, limit: Int = 10): [String!]!
    buscarSciPorOp(op: String!, prefix: String, limit: Int = 10): [String!]!
    refPorOpSci(op: String!, sci: String!): RefRow
    ctpnList: [String!]!
    maquinasPorCtpn(ctpn: String!): [Maquina!]!
  }

  type Mutation {
    crear_formulario(input: FormularioInput!): Formulario!
    updateFormulario(id: ID!, patch: FormularioPatch!): Formulario
    deleteFormulario(id: ID!): Formulario
    updateMultiplesFormularios(updates: [FormularioUpdateInput!]!): Boolean
    login(username: String!, password: String!): String
  }

  type Paro {
    id: ID!
    usuario: String!
    cedula: Int
    tipo_maquina: String!
    paro_maquina: String
    fecha_paro_inicio: Date
    hora_paro_inicio: String
    fecha_paro_final: Date
    hora_paro_final: String
    estado: String
    fecha_registro: String
    intervenciones: [Intervencion!]!
  }

  type Intervencion {
    id: ID!
    id_paro: ID!
    tipo_mantenimiento: String!
    observacion: String
    repuesto: [String]
    usuario_intervencion: String
    cedula_intervencion: Int
    fecha_intervencion_inicio: Date
    hora_intervencion_inicio: String
    fecha_intervencion_final: Date
    hora_intervencion_final: String
    fecha_registro: String
  }

  input ParoInput {
    usuario: String!
    cedula: Int
    tipo_maquina: String!
    paro_maquina: String
    fecha_paro_inicio: Date
    hora_paro_inicio: String
    fecha_paro_final: Date
    hora_paro_final: String
    estado: String!
  }

  input IntervencionInput {
    tipo_mantenimiento: String!
    observacion: String
    repuesto: [String]
    usuario_intervencion: String
    cedula_intervencion: Int
    fecha_intervencion_inicio: Date
    hora_intervencion_inicio: String
    fecha_intervencion_final: Date
    hora_intervencion_final: String
  }

  type TipoMaquina {
    id: ID!
    maquina: String!
  }

  type UsuarioMantenimiento {
    id: ID!
    nombre: String!
    cedula: Int
  }

  type TipoMantenimiento {
    id: ID!
    tipo: String!
  }

  extend type Query {
    tiposMaquina: [TipoMaquina!]!
    usuariosMantenimiento: [UsuarioMantenimiento!]!
    tiposMantenimiento: [TipoMantenimiento!]!
    paros(limit: Int, offset: Int, estado: String): [Paro!]!
    paro(id: ID!): Paro
    intervencionesDelParo(id_paro: ID!): [Intervencion!]!
  }

  extend type Mutation {
    crearParoConIntervencion(paro: ParoInput!, intervencion: IntervencionInput!): Paro!
    agregarIntervencion(id_paro: ID!, intervencion: IntervencionInput!): Intervencion!
    actualizarEstadoParo(id: ID!, estado: String!): Paro
    eliminarIntervencion(id: ID!): Intervencion
  }
`;