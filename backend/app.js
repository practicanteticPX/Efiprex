import express from 'express';
import http from 'http';
import path from 'path';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';

// =================================================================
// 1. IMPORTACIONES DE TU PROYECTO
// =================================================================
// Importa el schema y los resolvers unificados
import { typeDefs } from './bd/schema.js'; 
import { resolvers } from './bd/resolvers.js';
// Importa la conexión a la base de datos
import { pool, pool2 } from './bd/db.js'; 

// =================================================================
// 2. CONFIGURACIÓN DEL SERVIDOR
// =================================================================
async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  // Configura el servidor de Apollo con tu schema y resolvers
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
  });

  // Inicia el servidor de Apollo
  await apolloServer.start();

  // =================================================================
  // 3. MIDDLEWARE DE EXPRESS
  // =================================================================
  app.use(cors());
  app.use(express.json());

  // Middleware de Apollo para GraphQL en la ruta /graphql
  app.use('/graphql', expressMiddleware(apolloServer, {
    context: async ({ req }) => ({
      // Pasamos las funciones 'query' y 'query2' al contexto
      // para que los resolvers puedan usarlas
      query: (sql, params) => pool.query(sql, params),
      query2: (sql, params) => pool2.query(sql, params),
    }),
  }));

  // Servir los archivos estáticos de los frontends
  const __dirname = path.resolve(); // Directorio actual
  app.use('/formulario', express.static(path.join(__dirname, 'frontend/formulario')));
  app.use('/admin', express.static(path.join(__dirname, 'frontend/admin')));
  app.use('/login', express.static(path.join(__dirname, 'frontend/login')));
  app.use('/mantenimiento', express.static(path.join(__dirname, 'frontend/mantenimiento')));
  app.use('/editor', express.static(path.join(__dirname, 'frontend/editorMantenimiento')));
  app.use('/assets', express.static(path.join(__dirname, 'frontend/assets')));

  // Redirección a la página principal del formulario
  app.get('/', (req, res) => {
    res.redirect('/formulario');
  });
  
  // 4. INICIAR EL SERVIDOR
  const PORT = process.env.PORT || 5000;
  await new Promise((resolve) => httpServer.listen({ port: PORT }, resolve));

  console.log(`🚀 Servidor listo en http://localhost:${PORT}`);
  console.log(`🎨 Frontend del Formulario: http://localhost:${PORT}/formulario`);
  console.log(`🎨 Frontend del Admin: http://localhost:${PORT}/admin`);
  console.log(`🎨 Frontend de Mantenimiento: http://localhost:${PORT}/mantenimiento`);
  console.log(`🎨 Editor de Mantenimiento: http://localhost:${PORT}/editor`);
  console.log(`📡 Endpoint de GraphQL: http://localhost:${PORT}/graphql`);
}

startServer();