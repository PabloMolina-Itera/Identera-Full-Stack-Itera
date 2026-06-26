# Identera — Sistema de Carnets e Identidad Digital

Plataforma web full-stack para la generación, gestión y validación de carnets digitales con código QR. Diseñada para el control de acceso e identificación de colaboradores o asistentes a eventos, con soporte para escaneo individual y masivo en tiempo real.


## Resumen

Identera permite a una organización emitir carnets digitales únicos por persona. Cada carnet incluye nombre, cargo, datos de seguridad social (ARL, EPS), cédula, foto y un código QR de validación generado automáticamente. El sistema opera con tres roles: **ADMINISTRADOR**, **USUARIO** y **SEGURIDAD**, cada uno con accesos diferenciados. Toda la información vive en AWS DynamoDB y los carnets pueden descargarse como imagen PNG para uso físico o digital.

**Flujo general:**

1. El administrador crea usuarios desde el panel de administración.
2. Al registrar un usuario con rol USUARIO, el sistema genera automáticamente un carnet en blanco con un código validador único.
3. El usuario inicia sesión y completa su carnet con foto, datos personales y cargo.
4. Personal de seguridad o el administrador escanea los códigos QR para validar identidades de forma individual o masiva.


## Estructura del Proyecto

```
Identera-Full-Stack-Itera/
│
├── frontend/                         # Aplicación React + Vite
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example
│   ├── public/                       # Assets estáticos (logos, favicon SVG)
│   └── src/
│       ├── App.jsx                   # Router principal y guardas de ruta por rol
│       ├── main.jsx                  # Entry point de React
│       ├── index.css                 # Estilos globales y variables CSS
│       ├── pages/                    # 10 vistas de la aplicación
│       ├── components/               # 7 componentes reutilizables
│       ├── hooks/                    # 2 custom hooks
│       ├── services/                 # authService.js y apiService.js
│       └── utils/                    # carnetUtils.js
│
├── backend/
│   └── handlers/                     # Código fuente de las 4 Lambdas Node.js
│       ├── shared/
│       │   └── db.js                 # Cliente DynamoDB y helpers compartidos
│       ├── validaciones/
│       │   ├── index.js              # identera-lambda-validaciones
│       │   └── package.json
│       ├── usuarios/
│       │   ├── index.js              # identera-lambda-usuarios
│       │   └── package.json
│       ├── qr/
│       │   ├── index.js              # identera-lambda-qr
│       │   └── package.json
│       └── carnets/
│           ├── index.js              # identera-lambda-carnets
│           └── package.json
│
├── infra/                            # Infraestructura como código (AWS CDK - TypeScript)
│   ├── bin/identera.ts               # Entry point del CDK app
│   ├── lib/identera-stack.ts         # Stack principal: DynamoDB + Lambdas + API Gateway
│   ├── cdk.json
│   ├── package.json
│   └── tsconfig.json
│
├── deploy-lambda.sh                  # Script de deploy rápido por Lambda
├── docker-compose.yml                # DynamoDB Local para desarrollo
└── README.md
```


## Stack Tecnológico

### Frontend (validar @andryd)

| Tecnología | Versión | Rol |
|---|---|---|
| React | 19.2 | Framework de UI |
| Vite | 7.3 | Build tool y servidor de desarrollo |
| React Router DOM | 7.13 | Enrutamiento SPA |
| qrcode.react | 4.2 | Generación visual de códigos QR |
| html5-qrcode | 2.3 | Escaneo QR con cámara del dispositivo |
| jsQR | 1.4 | Decodificación de imágenes como fallback de escaneo |
| html2canvas | 1.4 | Exportar el carnet como imagen PNG |

> El frontend se comunica con el backend exclusivamente a través de HTTP hacia API Gateway. No utiliza el AWS SDK directamente.

### Backend

| Tecnología | Versión | Rol |
|---|---|---|
| Node.js | 20.x | Runtime de las Lambdas |
| AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`) | 3.600.0 | Acceso a DynamoDB desde las Lambdas |


## API — Endpoints Desplegados

**URL base (producción):**
```
https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod
```

**Autenticación:** todas las peticiones requieren el header:
```
x-api-key: a6276b1f7ad2b0379e7969cccba7e6bae9f39feb5bb20989a961a7a3813a40cd
```
Las solicitudes sin la key correcta reciben `401 Unauthorized`. Las solicitudes `OPTIONS` (preflight CORS) no requieren la key.

### identera-lambda-validaciones

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/validaciones` | Lista todos los carnets. Acepta `?userId=` para filtrar por usuario. |
| POST | `/validaciones?role=USUARIO` | Crea o sobreescribe el carnet activo. Si `role=USUARIO`, reemplaza el anterior del mismo usuario. Sincroniza los campos en el perfil del usuario. |
| DELETE | `/validaciones/{id}` | Elimina un carnet por ID. Devuelve la lista actualizada. |
| DELETE | `/validaciones/all/clear` | Elimina todos los carnets del sistema. Devuelve `[]`. |

**Cuerpo POST `/validaciones`:**
```json
{
  "id": "uuid-generado-por-frontend",
  "userId": "id-del-usuario",
  "fecha": "2026-06-11T17:00:00Z",
  "data": {
    "nombre": "Juan Pérez",
    "cargo": "Desarrollador",
    "arl": "Sura",
    "eps": "Sanitas",
    "cedula": "12345678",
    "codigoValidador": "ABCD1234",
    "foto": null
  }
}
```

### identera-lambda-usuarios

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/login` | Autentica al usuario. Devuelve el objeto usuario sin contraseña. Retorna 401 si las credenciales son incorrectas y 403 si la cuenta está inhabilitada. |
| GET | `/usuarios` | Lista todos los usuarios sin contraseña. |
| POST | `/usuarios` | Crea un usuario. Si `role=USUARIO`, genera automáticamente un carnet en blanco con código validador. |
| PATCH | `/usuarios/{email}/profile` | Actualiza nombre, email y contraseña opcionales. Maneja cambio de email (clave primaria en DynamoDB). |
| PATCH | `/usuarios/{email}/status` | Cambia el estado a `enabled` o `disabled`. El administrador raíz (`admin-id-123`) está protegido. |
| PATCH | `/usuarios/{email}/role` | Cambia el rol: `ADMINISTRADOR`, `USUARIO` o `SEGURIDAD`. El administrador raíz está protegido. |
| DELETE | `/usuarios/{email}` | Elimina el usuario y todos sus carnets asociados. El administrador raíz está protegido. |

**Cuerpo POST `/usuarios`:**
```json
{
  "id": "uuid-generado-por-frontend",
  "email": "usuario@dominio.com",
  "password": "contraseña",
  "name": "Nombre Completo",
  "role": "USUARIO",
  "status": "enabled"
}
```

### identera-lambda-qr

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/qr/regenerar?userId=` | Genera un nuevo código validador sin persistirlo. Útil para previsualización. |
| POST | `/qr/regenerar` | Genera y persiste un nuevo código en el carnet activo del usuario y en su perfil. |

**Cuerpo POST `/qr/regenerar`:**
```json
{ "userId": "id-del-usuario" }
```

**Respuesta:**
```json
{ "userId": "id-del-usuario", "codigoValidador": "BLQACCHQ" }
```

### identera-lambda-carnets

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/carnets` | Lista todos los carnets. Acepta `?userId=` para filtrar. |
| POST | `/carnets` | Crea un carnet nuevo. Genera `codigoValidador` automáticamente si no se envía. |
| PATCH | `/carnets/{carnetId}` | Edita campos del carnet de forma parcial (merge). Solo sobreescribe los campos enviados. |

**Cuerpo POST `/carnets`:**
```json
{
  "id": "uuid-generado-por-frontend",
  "userId": "id-del-usuario",
  "fechaCreacion": "2026-06-11T22:00:00Z",
  "nombre": "Pedro Prueba",
  "cargo": "Tester",
  "arl": "Colmena",
  "eps": "Compensar",
  "cedula": "98765432"
}
```


## Pruebas de Endpoints — Verificado en Producción (2026-06-11)

URL base: `https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod`

**GET /usuarios** — `200 OK`
```bash
curl https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod/usuarios \
  -H "x-api-key: a6276b1f7ad2b0379e7969cccba7e6bae9f39feb5bb20989a961a7a3813a40cd"
# → [{ "id": "admin-id-123", "email": "admin@identera.com", "role": "ADMINISTRADOR", "status": "enabled", ... }]
```

**POST /login** — `200 OK` / `401` / `403`
```bash
curl -X POST https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod/login \
  -H "x-api-key: a6276b1f7ad2b0379e7969cccba7e6bae9f39feb5bb20989a961a7a3813a40cd" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@identera.com","password":"admin123"}'
# → { "id": "admin-id-123", "email": "admin@identera.com", "role": "ADMINISTRADOR", "status": "enabled" }

curl -X POST https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod/login \
  -H "x-api-key: a6276b1f7ad2b0379e7969cccba7e6bae9f39feb5bb20989a961a7a3813a40cd" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@identera.com","password":"incorrecta"}'
# → 401 { "detail": "Credenciales incorrectas." }

curl -X POST https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod/login \
  -H "x-api-key: a6276b1f7ad2b0379e7969cccba7e6bae9f39feb5bb20989a961a7a3813a40cd" \
  -H "Content-Type: application/json" \
  -d '{"email":"inhabilitado@test.com","password":"test123"}'
# → 403 { "detail": "Tu cuenta ha sido inhabilitada. Contacta al administrador." }
```

**POST /usuarios** — `201 Created`
```bash
curl -X POST https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod/usuarios \
  -H "x-api-key: a6276b1f7ad2b0379e7969cccba7e6bae9f39feb5bb20989a961a7a3813a40cd" \
  -H "Content-Type: application/json" \
  -d '{"id":"uuid-1","email":"prueba@test.com","password":"test123","name":"Usuario Prueba","role":"USUARIO","status":"enabled"}'
# → { "id": "uuid-1", "email": "prueba@test.com", "role": "USUARIO", "status": "enabled", "createdAt": "2026-06-11T22:33:47.583Z" }
# El sistema genera automáticamente un carnet en blanco con codigoValidador para role=USUARIO.
```

**GET /carnets?userId=** — `200 OK`
```bash
curl "https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod/carnets?userId=uuid-1" \
  -H "x-api-key: a6276b1f7ad2b0379e7969cccba7e6bae9f39feb5bb20989a961a7a3813a40cd"
# → [{ "id": "...", "userId": "uuid-1", "fecha": "...", "data": { "nombre": "Usuario Prueba", "cargo": "Colaborador", "codigoValidador": "N8JECV6K", "arl": "—", "eps": "—", "cedula": "—", "foto": null } }]
```

**PATCH /carnets/{carnetId}** — `200 OK`
```bash
curl -X PATCH https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod/carnets/{carnetId} \
  -H "x-api-key: a6276b1f7ad2b0379e7969cccba7e6bae9f39feb5bb20989a961a7a3813a40cd" \
  -H "Content-Type: application/json" \
  -d '{"cargo":"Desarrollador","arl":"Sura","eps":"Sanitas","cedula":"12345678"}'
# → { "id": "...", "userId": "uuid-1", "data": { "cargo": "Desarrollador", "arl": "Sura", "eps": "Sanitas", "cedula": "12345678", "codigoValidador": "N8JECV6K", ... } }
```

**POST /qr/regenerar** — `200 OK`
```bash
curl -X POST https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod/qr/regenerar \
  -H "x-api-key: a6276b1f7ad2b0379e7969cccba7e6bae9f39feb5bb20989a961a7a3813a40cd" \
  -H "Content-Type: application/json" \
  -d '{"userId":"uuid-1"}'
# → { "userId": "uuid-1", "codigoValidador": "ATPLLRND" }

curl "https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod/qr/regenerar?userId=uuid-1" \
  -H "x-api-key: a6276b1f7ad2b0379e7969cccba7e6bae9f39feb5bb20989a961a7a3813a40cd"
# → { "userId": "uuid-1", "codigoValidador": "XJEHXUQ3" }  (no persiste)
```

**PATCH /usuarios/{email}/status** — `200 OK`
```bash
curl -X PATCH https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod/usuarios/prueba%40test.com/status \
  -H "x-api-key: a6276b1f7ad2b0379e7969cccba7e6bae9f39feb5bb20989a961a7a3813a40cd" \
  -H "Content-Type: application/json" \
  -d '{"status":"disabled"}'
# → { "status": "success" }
```

**DELETE /usuarios/{email}** — `200 OK`
```bash
curl -X DELETE https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod/usuarios/prueba%40test.com \
  -H "x-api-key: a6276b1f7ad2b0379e7969cccba7e6bae9f39feb5bb20989a961a7a3813a40cd"
# → { "status": "success" }  (elimina el usuario y todos sus carnets asociados)
```

**GET /validaciones** — `200 OK`
```bash
curl https://oxedtkrjf7.execute-api.us-east-1.amazonaws.com/prod/validaciones \
  -H "x-api-key: a6276b1f7ad2b0379e7969cccba7e6bae9f39feb5bb20989a961a7a3813a40cd"
# → []
```


## Modelo de Datos — DynamoDB (`IdenteraDB`)

Tabla única con patrón single-table. Todos los registros conviven en la misma tabla diferenciados por `entity_type`.

| Entidad | PK | SK | entity_type |
|---|---|---|---|
| Usuario | `USER#{email}` | `PROFILE#{email}` | `usuario` |
| Carnet / Validación | `VALIDACIONES_GLOBAL` | `VAL#{id}` | `validacion` |

**Campos principales de un usuario:**
`id`, `email`, `name`, `role`, `status`, `password`, `createdAt`, `cargo`, `cedula`, `arl`, `eps`, `codigoValidador`, `foto`

**Campos principales de una validación:**
`id`, `userId`, `fecha`, `data` (objeto con nombre, cargo, arl, eps, cedula, codigoValidador, foto)

El vínculo entre carnet y usuario es el campo `userId` del carnet, que referencia el `id` del usuario. Cada usuario con `role=USUARIO` tiene exactamente un carnet activo con su `codigoValidador` único — el mismo valor se replica en el perfil del usuario para consultas rápidas.

**Cuenta de administrador raíz** (debe crearse una sola vez vía `POST /usuarios`):

| Campo | Valor |
|---|---|
| id | `admin-id-123` |
| email | `admin@identera.com` |
| password | `admin123` |
| role | `ADMINISTRADOR` |

Se recomienda cambiar la contraseña tras el primer acceso.


## Componentes del Frontend (validar @andryd)

### Páginas (`src/pages/`)

| Ruta | Componente | Acceso | Descripción |
|---|---|---|---|
| `/` | `Landing.jsx` | Público | Redirige según el rol del usuario autenticado |
| `/login` | `Login.jsx` | Público | Formulario de inicio de sesión |
| `/crear` | `CrearQR.jsx` | USUARIO, ADMINISTRADOR | |
| `/mis-carnets` | `MisCarnets.jsx` | USUARIO, ADMINISTRADOR | |
| `/validar` | `Validar.jsx` | Público | |
| `/escaneo-masa` | `EscaneoMasa.jsx` | Público | |
| `/dashboard` | `Dashboard.jsx` | ADMINISTRADOR | |
| `/admin` | `AdminDashboard.jsx` | ADMINISTRADOR | |
| `/admin-carnets` | `AdminCarnets.jsx` | ADMINISTRADOR | |
| `*` | `NotFound.jsx` | Público | Vista 404 para rutas no encontradas |

### Componentes Reutilizables (`src/components/`) (validar @andryd)

| Componente | Descripción |
|---|---|
| `CarnetCard.jsx` | |
| `Navbar.jsx` | |
| `Layout.jsx` | |
| `Footer.jsx` | |
| `Toast.jsx` + `toastService.js` | |
| `ErrorBoundary.jsx` | |

### Custom Hooks (`src/hooks/`) (validar @andryd)

| Hook | Descripción |
|---|---|
| `useScanner.js` | |
| `useImageUploader.js` | |


## Infraestructura AWS y CDK

El stack `IdenteraStack` se define en `infra/lib/identera-stack.ts` y provisiona todos los recursos en la cuenta `963753594188`, región `us-east-1`.

| Recurso | Identificador | Detalles |
|---|---|---|
| DynamoDB | `IdenteraDB` | Tabla única, patrón single-table, PAY_PER_REQUEST, PITR activado |
| Lambda | `identera-lambda-validaciones` | Node.js 20, 512 MB, 30 s timeout |
| Lambda | `identera-lambda-usuarios` | Node.js 20, 512 MB, 30 s timeout |
| Lambda | `identera-lambda-qr` | Node.js 20, 512 MB, 30 s timeout |
| Lambda | `identera-lambda-carnets` | Node.js 20, 512 MB, 30 s timeout |
| API Gateway REST | `identera-api` | Stage `prod`, CORS abierto |
| CloudFormation Stack | `IdenteraStack` | Región `us-east-1`, cuenta `963753594188` |

**Herramientas CDK:**

| Herramienta | Versión |
|---|---|
| AWS CDK | 2.173.2 |
| TypeScript | 5.7.3 |
| ts-node | 10.9.2 |

**Tags aplicadas a todos los recursos:**

| Etiqueta | Valor |
|---|---|
| proyecto | Identera |
| cliente | Itera / Preventa |
| arquitecto | Juan Castillo |
| arquitecto2 | Juan Pablo Molina |
| arquitecto3 | Andryd Ibarra |
| PM | Xiomara Valencia |
| Aprobador | Sebastian Sanchez |

### Variables de entorno de las Lambdas

Cada Lambda requiere dos variables de entorno configuradas en AWS. Para actualizarlas todas a la vez:

```bash
for fn in identera-lambda-validaciones identera-lambda-usuarios identera-lambda-qr identera-lambda-carnets; do
  aws lambda update-function-configuration \
    --function-name $fn \
    --environment "Variables={DYNAMODB_TABLE_NAME=IdenteraDB,API_KEY=a6276b1f7ad2b0379e7969cccba7e6bae9f39feb5bb20989a961a7a3813a40cd}" \
    --region us-east-1
done
```

O manualmente desde la consola: Lambda → función → Configuración → Variables de entorno.

| Variable | Valor |
|---|---|
| `DYNAMODB_TABLE_NAME` | `IdenteraDB` |
| `API_KEY` | `a6276b1f7ad2b0379e7969cccba7e6bae9f39feb5bb20989a961a7a3813a40cd` |


## Despliegue

**Requisitos previos:** Node.js 18+, AWS CLI autenticado, AWS CDK instalado globalmente.

### Primera vez (bootstrap)

```bash
cd infra && npm install
eval $(aws configure export-credentials --format env)
npx cdk bootstrap aws://963753594188/us-east-1
```

### Stack completo

```bash
cd infra
eval $(aws configure export-credentials --format env)
npx cdk deploy --require-approval never
```

### Actualizar una Lambda sin redeplegar el stack

```bash
bash deploy-lambda.sh validaciones   # solo identera-lambda-validaciones
bash deploy-lambda.sh usuarios       # solo identera-lambda-usuarios
bash deploy-lambda.sh qr             # solo identera-lambda-qr
bash deploy-lambda.sh carnets        # solo identera-lambda-carnets
bash deploy-lambda.sh all            # las 4 a la vez
```

El script empaqueta el código fuente, copia `shared/db.js`, instala dependencias de producción y sube el ZIP con `aws lambda update-function-code`.

### Variables de entorno del frontend (validar @andryd)

Crea `frontend/.env` a partir de `frontend/.env.example`:

```env
VITE_API_BASE_URL=           # URL del API Gateway (prod o local)
VITE_API_KEY=                # API Key del proyecto (ver sección de infraestructura)
```

### Levantar el frontend en desarrollo

```bash
cd frontend && npm install && npm run dev
```

Disponible en `http://localhost:5173`.


## Soporte

Desarrollado y mantenido por **Itera Process** — [iteraprocess.com](https://iteraprocess.com)

| Rol | Contacto |
|---|---|
| Arquitecto / Backend | Juan Castillo |
| Arquitecto / Backend / QA | Juan Pablo Molina |
| Arquitecta / Frontend | Andryd Ibarra |
| PM | Xiomara Valencia |
| Aprobador | Sebastian Sanchez |

---

*Identera es un producto interno de Itera Process. Todos los derechos reservados © 2026.*
