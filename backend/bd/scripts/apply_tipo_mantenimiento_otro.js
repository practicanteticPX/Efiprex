import { pool } from '../db.js';

const sql = `
  INSERT INTO public."T_Dim_TipoMantenimiento" (tipo)
  SELECT $1
  WHERE NOT EXISTS (
    SELECT 1
    FROM public."T_Dim_TipoMantenimiento"
    WHERE LOWER(TRIM(tipo)) = $2
  )
`;

await pool.query(sql, ['Otro', 'otro']);

const { rows } = await pool.query(
  `SELECT id, tipo
   FROM public."T_Dim_TipoMantenimiento"
   WHERE LOWER(TRIM(tipo)) = $1`,
  ['otro']
);

console.log(JSON.stringify(rows));
await pool.end();
