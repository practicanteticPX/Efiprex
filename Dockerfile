# Usa una imagen base de Node.js ligera y moderna
FROM node:18-alpine

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de dependencias primero para aprovechar el caché de Docker
COPY package.json ./
COPY package-lock.json ./

# Instala las dependencias del proyecto
RUN npm install

# Copia el resto del código de tu proyecto al contenedor
# Esto incluye las carpetas backend, frontend y assets
COPY . .

# Expone el puerto en el que corre la aplicación dentro del contenedor
EXPOSE 5000

# El comando para iniciar la aplicación cuando el contenedor se ejecute
CMD ["npm", "start"]