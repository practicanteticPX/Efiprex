import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config(); // Carga las variables del .env

// Usamos process.cwd() para obtener la ruta raíz del proyecto (donde se ejecuta app.js)
const certsDir = path.join(process.cwd(), 'certs');

// Configuramos el objeto SSL leyendo los certificados desde la carpeta "certs"
const sslConfig = {
  ca: fs.readFileSync(path.join(certsDir, 'ca-cert.pem')).toString(),
  cert: fs.readFileSync(path.join(certsDir, 'admin-cert.pem')).toString(),
  key: fs.readFileSync(path.join(certsDir, 'admin-key.pk8')).toString(),
  rejectUnauthorized: true,
  checkServerIdentity: () => undefined
};

// Pool para la base de datos principal (DB_QPREX)
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});

// Pool para la segunda base de datos (SERV_QPREX)
export const pool2 = new pg.Pool({
  connectionString: process.env.DATABASE_URL_2,
  ssl: sslConfig,
});

console.log('Pools de bases de datos configurados con certificados desde la carpeta /certs.');