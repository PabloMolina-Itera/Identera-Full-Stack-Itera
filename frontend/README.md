# Identera Frontend

Este es el frontend oficial del proyecto **Identera**, una aplicación web construida con **React** y **Vite**, encargada de la interfaz de usuario, gestión de perfiles, administración de iterantes y generación/escaneo de carnets (códigos QR).

## Arquitectura y Flujo de Datos

```mermaid
sequenceDiagram
    participant U as Usuario
    participant R as React (Frontend)
    participant A as API FastAPI (AWS Backend)
    participant D as DynamoDB

    
    U->>R: Interactúa con la UI (ej. Ver Carnet)
    R->>A: Petición HTTP (GET/POST a /api/...)
    A->>D: Operación de Base de Datos
    D-->>A: Resultados (JSON)
    A-->>R: Respuesta JSON
    R-->>U: Actualiza la Interfaz / Muestra QR
```

## Tecnologías Principales

- **React 19**: Biblioteca principal para la construcción de interfaces de usuario.
- **Vite**: Herramienta de construcción y servidor de desarrollo ultrarrápido con Hot Module Replacement (HMR).
- **React Router DOM**: Manejo de rutas y navegación de la Single Page Application (SPA).
- **Librerías QR y multimedia**: 
  - `qrcode.react`: Para la generación visual de códigos QR del carnet.
  - `html5-qrcode` y `jsqr`: Para escanear, leer y procesar validaciones de códigos QR.
  - `html2canvas`: Para capturar elementos del DOM y permitir la exportación/descarga de carnets.

## Estructura del Proyecto

- `src/`: Código fuente principal de la aplicación.
  - `components/`: Componentes reutilizables de React (ej. `CarnetCard.jsx`).
  - `pages/`: Vistas completas de la aplicación (Landing, Dashboard, Creación de QR, etc.).
  - `services/`: Módulos encargados de interactuar con el backend mediante peticiones HTTP (ej. `apiService.js`, `authService.js`).
- `public/`: Archivos estáticos accesibles directamente.
- `package.json`: Declaración de dependencias y scripts de Node.js.
- `vite.config.js`: Configuración del empaquetador Vite.

## Desarrollo Local

### Requisitos Previos

- **Node.js** (versión 18+ recomendada)
- **npm** (gestor de paquetes)

### Pasos para iniciar

1. **Instalar las dependencias**:
   ```bash
   npm install
   ```

2. **Configuración de Variables de Entorno**:
   Copia el archivo `.env.example` (si existe) a `.env` y configura la URL base del backend local (generalmente apuntando al puerto `8000` de FastAPI). 
   Para producción, esta variable debe apuntar a la URL de AWS API Gateway.

3. **Ejecutar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   La aplicación se levantará localmente con Vite (por defecto en `http://localhost:5173` o similar) y recargará automáticamente tus cambios.

## Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo.
- `npm run build`: Compila la aplicación para producción de manera optimizada en la carpeta `dist/`.
- `npm run lint`: Ejecuta ESLint para analizar el código.
- `npm run preview`: Sirve localmente la versión compilada de producción para validarla antes de desplegar.

## Guía de Despliegue (Producción)

Al ser una aplicación **React / Vite** basada en archivos estáticos, el despliegue es sumamente sencillo. Puedes alojarlo en múltiples plataformas (como AWS S3 + CloudFront, Vercel, Netlify, Github Pages, etc.).

### Flujo de despliegue general

1. **Configurar el endpoint del Backend**:
   Asegúrate de que en el archivo `.env` o en las variables de entorno de tu proveedor de hosting (ej. `VITE_API_URL`) apunten a la URL de producción de tu API (la URL que te devolvió AWS SAM en el paso de despliegue del backend).
   
2. **Construir los archivos para Producción**:
   ```bash
   npm run build
   ```
   Esto generará una carpeta `dist/` en tu directorio raíz que contiene el HTML, CSS y JS optimizado, minimizado y listo para producción.

3. **Alojar los archivos (`dist/`)**:
   - **Opción AWS (Recomendada para un ecosistema unificado)**: Sube el contenido de la carpeta `dist/` a un **Amazon S3 Bucket** configurado como alojamiento web estático y sírvelo mediante **Amazon CloudFront** para aprovechar HTTPS y caché global rápida.
   - **Opción Vercel / Netlify**: Simplemente conecta tu repositorio de GitHub directamente a estas plataformas. Ellas detectarán automáticamente que es un proyecto de Vite y ejecutarán el script de build en cada commit a la rama principal (main/master).

   hola
