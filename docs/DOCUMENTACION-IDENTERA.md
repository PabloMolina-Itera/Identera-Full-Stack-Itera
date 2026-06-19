# Proyecto: Identera — Sistema de Gestión de Identidad y Validación QR

## Objetivo del Proyecto

Desplegar una plataforma serverless full-stack sobre AWS que permita crear, gestionar, validar y auditar carnets de identidad digital con códigos QR, integrando React 19 en el frontend con API Gateway, Lambdas Node.js 20 y DynamoDB en el backend.

---

## Estado Actual

### Infraestructura AWS Verificada

| Componente | Estado | Detalle |
|---|---|---|
| API Gateway | ✅ Desplegado | `https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod` |
| Lambda validaciones | ✅ Desplegado | `identera-lambda-validaciones` |
| Lambda usuarios | ✅ Desplegado | `identera-lambda-usuarios` |
| Lambda qr | ✅ Desplegado | `identera-lambda-qr` |
| Lambda carnets | ✅ Desplegado | `identera-lambda-carnets` |
| DynamoDB | ✅ Desplegado | Tabla `IdenteraDB` (PK+SK single-table design) |
| CloudFront | ✅ Activo | Distribución CDN delante de API Gateway |
| Frontend | ✅ Desarrollo local | `http://127.0.0.1:5173` (Vite dev server) |

### Credenciales Configuradas

- **API URL**: `https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod`
- **Región**: `us-east-1`
- **API Key**: Configurada en archivo `.env` (`VITE_API_KEY`)
- **Autenticación**: API Key + CORS habilitado (`access-control-allow-origin: *`)

### Limitaciones Identificadas

1. **Doble llamada en desarrollo**: React StrictMode duplica cada `useEffect` en modo desarrollo, causando requests duplicados al endpoint `/validaciones`. Solucionado con sistema de deduplicación de requests en vuelo en `apiService.js`.

2. **CORS Preflight**: Cada request con header `x-api-key` requiere preflight OPTIONS. Mitigado removiendo `Content-Type` innecesario en requests GET.

3. **Sección "Validaciones guardadas"**: Originalmente guardaba en DynamoDB mediante `POST /validaciones` y `DELETE /validaciones/all/clear`, lo que borraba TODOS los carnets. Corregido para usar `localStorage` del navegador.

4. **Endpoints sin uso**: `POST /qr/regenerar` y `POST /carnets` están definidos en el frontend pero ningún componente los invoca actualmente.

---

## Especificaciones Técnicas

### Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
│  React 19 + Vite 7 + React Router 7                            │
│  http://127.0.0.1:5173 (dev)                                    │
│                                                                 │
│  Pages: 10  |  Components: 7  |  Hooks: 2  |  Services: 2      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ fetch + x-api-key
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AWS API Gateway (REST)                        │
│  https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod   │
│  17 rutas  |  CORS *  |  CloudFront CDN                        │
└──────┬──────────┬──────────┬──────────┬─────────────────────────┘
       │          │          │          │
       ▼          ▼          ▼          ▼
┌──────────┐┌──────────┐┌──────────┐┌──────────┐
│ Lambda   ││ Lambda   ││ Lambda   ││ Lambda   │
│validacion││usuarios  ││qr        ││carnets   │
│Node.js20 ││Node.js20 ││Node.js20 ││Node.js20 │
│512 MB    ││512 MB    ││512 MB    ││512 MB    │
│30s t/o   ││30s t/o   ││30s t/o   ││30s t/o   │
└────┬─────┘└────┬─────┘└────┬─────┘└────┬─────┘
     │           │           │           │
     └───────────┴───────────┴───────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│           Amazon DynamoDB — IdenteraDB (Single-Table)           │
│  PK: userId  |  SK: tipo#id  |  PAY_PER_REQUEST                 │
│  Point-in-Time Recovery  |  RETAIN on destroy                   │
└─────────────────────────────────────────────────────────────────┘
```

### Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend Framework | React | 19.x |
| Build Tool | Vite | 7.x |
| Router | React Router DOM | 7.x |
| Lector QR | html5-qrcode | latest |
| QR Fallback | jsqr | latest |
| Descarga Carnet | html2canvas | latest |
| Backend Runtime | Node.js | 20 |
| Lambda Bundle | AWS SDK v3 (DynamoDB) | latest |
| Base de Datos | DynamoDB Single-Table | PAY_PER_REQUEST |
| API Gateway | AWS REST API | CloudFront CDN |
| IaC | AWS CDK (TypeScript) | 2.173.2 |
| Despliegue Lambda | Shell Script (`deploy-lambda.sh`) | bash |

### Configuración de Lambdas

| Parámetro | Valor |
|---|---|
| Runtime | Node.js 20.x |
| Memoria | 512 MB |
| Timeout | 30 segundos |
| Bundling | `npm install --omit=dev` + copia `shared/` |
| Módulo Compartido | `backend/handlers/shared/db.js` |
| API Key Validation | Header `x-api-key` en cada request |
| CORS | `access-control-allow-origin: *` |

### Configuración DynamoDB

| Parámetro | Valor |
|---|---|
| Nombre de Tabla | `IdenteraDB` |
| Partition Key | `userId` (String) |
| Sort Key | `tipo#id` (String) |
| Capacidad | On-Demand (PAY_PER_REQUEST) |
| Point-in-Time Recovery | Habilitado |
| Remoción al Destruir | RETAIN |

### Estimación de Costos (Servicios AWS usados)

| Servicio | Estimación Mensual |
|---|---|
| API Gateway | $3.50/millón de requests (~$1-5/mes) |
| Lambda | $0.20/millón de invocaciones (~$0-2/mes) |
| DynamoDB | $1.25/millón de WCU (~$0-5/mes) |
| CloudFront | $0.085/GB transfer (~$0-2/mes) |
| **Total mensual estimado** | **~$5-15/mes** |

---

## Catálogo de APIs

### 🔐 Autenticación y Usuarios — `usuarios` Lambda

| # | Método | Endpoint | Descripción | Frontend |
|---|---|---|---|---|
| 1 | `POST` | `/login` | Iniciar sesión con email + password | [Login.jsx:72](frontend/src/pages/Login.jsx#L72) — Botón **"Iniciar Sesión"** |
| 2 | `GET` | `/usuarios` | Listar todos los usuarios (admin) | [AdminDashboard.jsx:33](frontend/src/pages/AdminDashboard.jsx#L33) — Automático al entrar |
| 3 | `POST` | `/usuarios` | Crear usuario nuevo (admin) | [AdminDashboard.jsx:225](frontend/src/pages/AdminDashboard.jsx#L225) — Botón **"Crear Usuario"** |
| 4 | `PATCH` | `/usuarios/{email}/profile` | Editar perfil de usuario | [AdminDashboard.jsx:257](frontend/src/pages/AdminDashboard.jsx#L257) — Botón **"Guardar Cambios"** |
| 5 | `PATCH` | `/usuarios/{email}/status` | Activar/desactivar usuario | [AdminDashboard.jsx:155](frontend/src/pages/AdminDashboard.jsx#L155) — Botón **"Inhabilitar" / "Habilitar"** |
| 6 | `PATCH` | `/usuarios/{email}/role` | Cambiar rol de usuario | [AdminDashboard.jsx:139](frontend/src/pages/AdminDashboard.jsx#L139) — **Dropdown `<select>`** |
| 7 | `DELETE` | `/usuarios/{email}` | Eliminar usuario y sus carnets | [AdminDashboard.jsx:169](frontend/src/pages/AdminDashboard.jsx#L169) — Botón **"Eliminar"** |

### 🎫 Carnets y Validaciones — `validaciones` Lambda

| # | Método | Endpoint | Descripción | Frontend |
|---|---|---|---|---|
| 8 | `GET` | `/validaciones` | Listar todos los carnets | 5 páginas — Automático al cargar |
| 9 | `GET` | `/validaciones?userId={id}` | Filtrar carnets por usuario | [MisCarnets.jsx:17](frontend/src/pages/MisCarnets.jsx#L17), [CrearQR.jsx:61](frontend/src/pages/CrearQR.jsx#L61) |
| 10 | `POST` | `/validaciones?role={role}` | Crear/guardar un carnet | [CrearQR.jsx:116](frontend/src/pages/CrearQR.jsx#L116) — Auto-guardado |
| 11 | `DELETE` | `/validaciones/{id}` | Eliminar un carnet específico | [MisCarnets.jsx:107](frontend/src/pages/MisCarnets.jsx#L107) — Botón **"🗑️ Eliminar"** |
| 12 | `DELETE` | `/validaciones/all/clear` | ⚠️ Borrar TODOS los carnets | [Deshabilitado] — Usa `localStorage` ahora |

### 📱 QR y Carnets — `qr` Lambda + `carnets` Lambda

| # | Método | Endpoint | Descripción | Frontend |
|---|---|---|---|---|
| 13 | `POST` | `/qr/regenerar` | Regenerar código QR de un usuario | ❌ Sin uso actual |
| 14 | `PATCH` | `/carnets/{carnetId}` | Editar campos de un carnet | [MisCarnets.jsx:99](frontend/src/pages/MisCarnets.jsx#L99) — Botón **"🔄 Regenerar QR"** |
| 15 | `POST` | `/carnets` | Crear carnet (endpoint alternativo) | ❌ Sin uso actual |

---

## Componentes Frontend

### Páginas y Rutas

| Ruta | Componente | Roles | Descripción |
|---|---|---|---|
| `/` | [Landing.jsx](frontend/src/pages/Landing.jsx) | Público | Landing page con redirect por rol |
| `/login` | [Login.jsx](frontend/src/pages/Login.jsx) | Público | Formulario de inicio de sesión |
| `/crear` | [CrearQR.jsx](frontend/src/pages/CrearQR.jsx) | ADMIN, USUARIO | Creación y edición de carnets con QR |
| `/mis-carnets` | [MisCarnets.jsx](frontend/src/pages/MisCarnets.jsx) | ADMIN, USUARIO | Historial y gestión de carnets propios |
| `/validar` | [Validar.jsx](frontend/src/pages/Validar.jsx) | SEGURIDAD | Escaneo y validación de QR |
| `/escaneo-masa` | [EscaneoMasa.jsx](frontend/src/pages/EscaneoMasa.jsx) | SEGURIDAD | Validación masiva de QR |
| `/dashboard` | [Dashboard.jsx](frontend/src/pages/Dashboard.jsx) | ADMIN | Panel de estadísticas de carnets |
| `/admin` | [AdminDashboard.jsx](frontend/src/pages/AdminDashboard.jsx) | ADMIN | Gestión completa de usuarios |
| `/admin-carnets` | [AdminCarnets.jsx](frontend/src/pages/AdminCarnets.jsx) | ADMIN | Gestión y búsqueda de carnets |

### Componentes Compartidos

| Componente | Archivo | Descripción |
|---|---|---|
| Navbar | [Navbar.jsx](frontend/src/components/Navbar.jsx) | Barra de navegación con menú por rol |
| Footer | [Footer.jsx](frontend/src/components/Footer.jsx) | Pie de página |
| Layout | [Layout.jsx](frontend/src/components/Layout.jsx) | Wrapper con Navbar + Outlet + Footer |
| CarnetCard | [CarnetCard.jsx](frontend/src/components/CarnetCard.jsx) | Tarjeta visual del carnet con QR y foto |
| Toast | [Toast.jsx](frontend/src/components/Toast.jsx) | Notificaciones tipo toast |
| ErrorBoundary | [ErrorBoundary.jsx](frontend/src/components/ErrorBoundary.jsx) | Captura de errores de renderizado |

### Servicios

| Servicio | Archivo | Responsabilidad |
|---|---|---|
| apiService | [apiService.js](frontend/src/services/apiService.js) | Conexión con API Gateway para carnets/validaciones/QR |
| authService | [authService.js](frontend/src/services/authService.js) | Autenticación y gestión de usuarios |

### Hooks Personalizados

| Hook | Archivo | Descripción |
|---|---|---|
| useScanner | [useScanner.js](frontend/src/hooks/useScanner.js) | Escaneo QR con cámara (html5-qrcode) y fallback de imagen (jsqr) |
| useImageUploader | [useImageUploader.js](frontend/src/hooks/useImageUploader.js) | Redimensiona fotos a 150px en base64 WebP |

---

## Roles de Usuario

| Rol | Permisos | Páginas |
|---|---|---|
| **ADMINISTRADOR** | Crear/editar/borrar usuarios y carnets, ver estadísticas, validar | Landing, Dashboard, Admin, AdminCarnets, CrearQR, MisCarnets, Validar, EscaneoMasa |
| **USUARIO** | Crear y ver sus propios carnets | Landing, CrearQR, MisCarnets |
| **SEGURIDAD** | Escanear y validar carnets en eventos | Landing, Validar, EscaneoMasa |

---

## Flujos Principales

### 1. Creación de Carnet

```
Admin crea usuario → AdminDashboard → POST /usuarios
   ↓
Admin asigna carnet → CrearQR → llena formulario → auto-guardado 1s → POST /validaciones
   ↓
CarnetCard renderiza QR + código validador + foto → usuario descarga PNG
```

### 2. Validación de Carnet en Evento

```
Seguridad abre /validar → Activar Cámara → html5-qrcode escanea QR
   ↓
onScanSuccess → GET /validaciones → busca código validador en DynamoDB
   ↓
¿Coincide? → ✅ CarnetCard con datos  |  ❌ "Carnet no válido"
   ↓
Guardar en este dispositivo → localStorage (solo este navegador)
```

### 3. Escaneo Masivo

```
Seguridad abre /escaneo-masa → Cámara activa continua
   ↓
Cada QR detectado → GET /validaciones → validación una por una
   ↓
Resultados se acumulan en pantalla (válidos e inválidos)
```

### 4. Regeneración de QR

```
Usuario en /mis-carnets → Botón "🔄 Regenerar QR"
   ↓
Genera nuevo código validador aleatorio (8 caracteres)
   ↓
PATCH /carnets/{id} → actualiza codigoValidador en DynamoDB
```

---

## Esquema DynamoDB — Single Table Design

```
┌──────────────────────────────────────────────────────────────┐
│                    IdenteraDB                                │
├──────────────┬───────────────────────┬───────────────────────┤
│ userId (PK)  │ tipo#id (SK)          │ Atributos             │
├──────────────┼───────────────────────┼───────────────────────┤
│ user-123     │ USUARIO#user-123      │ name, email, password,│
│              │                       │ role, status, qrCode  │
├──────────────┼───────────────────────┼───────────────────────┤
│ user-123     │ CARNET#abc-456        │ nombre, cargo, arl,   │
│              │                       │ eps, cedula, foto,    │
│              │                       │ codigoValidador, fecha│
├──────────────┼───────────────────────┼───────────────────────┤
│ user-456     │ USUARIO#user-456      │ name, email, ...      │
├──────────────┼───────────────────────┼───────────────────────┤
│ user-456     │ CARNET#def-789        │ nombre, cargo, ...    │
└──────────────┴───────────────────────┴───────────────────────┘
```

**Usuario Admin protegido**: `id = admin-id-123` — No se puede eliminar, inhabilitar ni cambiar rol.

---

## Comandos de Despliegue

### Infraestructura (CDK)

```bash
cd infra
npm install
npx cdk synth          # Sintetizar CloudFormation
npx cdk diff            # Ver cambios antes de desplegar
npx cdk deploy          # Desplegar stack completo
npx cdk destroy         # Destruir stack (mantiene DynamoDB por RETAIN)
```

### Actualización de Lambdas (sin redeploy completo)

```bash
./deploy-lambda.sh validaciones   # Una Lambda
./deploy-lambda.sh usuarios
./deploy-lambda.sh qr
./deploy-lambda.sh carnets
./deploy-lambda.sh all            # Todas
```

### Frontend (Desarrollo Local)

```bash
cd frontend
npm install
npm run dev          # Inicia en http://127.0.0.1:5173
npm run build        # Build de producción
npm run preview      # Previsualizar build
```

---

## Estructura de Archivos

```
Identera-Full-Stack-Itera/
├── frontend/
│   ├── src/
│   │   ├── components/      # 7 componentes React
│   │   ├── hooks/           # useScanner, useImageUploader
│   │   ├── pages/           # 10 páginas
│   │   ├── services/        # apiService, authService
│   │   ├── utils/           # carnetUtils
│   │   ├── App.jsx          # Rutas protegidas por rol
│   │   └── main.jsx         # Entry point + StrictMode
│   ├── public/              # Logos modo día/noche
│   ├── .env                 # VITE_API_URL + VITE_API_KEY
│   └── package.json         # React 19, Vite 7
├── backend/
│   └── handlers/
│       ├── validaciones/    # Lambda CRUD carnets
│       ├── usuarios/        # Lambda auth + CRUD usuarios
│       ├── qr/              # Lambda regeneración QR
│       ├── carnets/         # Lambda CRUD alternativo
│       └── shared/          # db.js (cliente DynamoDB compartido)
├── infra/
│   ├── bin/identera.ts      # Entry point CDK
│   ├── lib/identera-stack.ts # Stack principal (DynamoDB + Lambdas + API Gateway)
│   ├── cdk.json
│   └── package.json         # aws-cdk 2.173.2
├── deploy-lambda.sh         # Script de despliegue rápido de Lambdas
└── docs/
    └── DOCUMENTACION-IDENTERA.md  # Este documento
```

---

## Recursos y Referencias

- [Amazon API Gateway Developer Guide](https://docs.aws.amazon.com/apigateway/latest/developerguide/)
- [AWS Lambda Developer Guide (Node.js)](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
- [Amazon DynamoDB Single-Table Design](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [html5-qrcode GitHub](https://github.com/mebjas/html5-qrcode)
- [jsQR GitHub](https://github.com/cozmo/jsQR)

---

**Nota**: Este documento se actualizará con los IDs de recursos específicos (VPC ID, Security Group IDs, Subnet IDs, Endpoint) y capturas de pantalla de cada botón/flujo una vez completada la documentación visual.

🤖 Generado con [Claude Code](https://claude.com/claude-code)
