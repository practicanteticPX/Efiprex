import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config(); // Carga las variables del .env

// Pool para la base de datos principal (DB_QPREX)
// Lee la variable DATABASE_URL directamente
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Pool para la segunda base de datos (SERV_QPREX)
// Lee la variable DATABASE_URL_2
export const pool2 = new pg.Pool({
  connectionString: process.env.DATABASE_URL_2,
});

console.log('Pools de bases de datos configurados desde las URLs.');