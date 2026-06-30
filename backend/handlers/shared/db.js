/**
 * shared/db.js
 * Cliente DynamoDB compartido entre todas las Lambdas.
 * Implementa las mismas operaciones que el database.py original.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "IdenteraDB";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});
const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

// ─── USUARIOS ────────────────────────────────────────────────────────────────

async function crearUsuario({ id, email, name, role, status, password }) {
  const now = new Date().toISOString();
  const item = {
    PK: `USER#${email}`,
    SK: `PROFILE#${email}`,
    id: id || randomUUID(),
    email,
    name,
    role,
    status,
    password,
    createdAt: now,
    entity_type: "usuario",
  };
  await db.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

async function obtenerUsuario(email) {
  const res = await db.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${email}`, SK: `PROFILE#${email}` },
    })
  );
  return res.Item || null;
}

async function listarUsuarios() {
  const res = await db.send(new ScanCommand({ TableName: TABLE_NAME }));
  return (res.Items || []).filter((i) => i.entity_type === "usuario");
}

async function eliminarUsuario(email) {
  await db.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${email}`, SK: `PROFILE#${email}` },
    })
  );
}

async function actualizarPerfilUsuario(oldEmail, { name, email: newEmail, password }) {
  const oldUser = await obtenerUsuario(oldEmail);
  if (!oldUser) throw new Error(`Usuario no encontrado: ${oldEmail}`);

  if (oldEmail !== newEmail) {
    const existe = await obtenerUsuario(newEmail);
    if (existe) throw new Error(`Ya existe un usuario con el correo ${newEmail}`);
    await eliminarUsuario(oldEmail);
  }

  const item = {
    ...oldUser,
    PK: `USER#${newEmail}`,
    SK: `PROFILE#${newEmail}`,
    email: newEmail,
    name,
    password: password || oldUser.password,
  };

  await db.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

// ─── VALIDACIONES / CARNETS ───────────────────────────────────────────────────

async function crearValidacion({ id, userId, fecha, data }) {
  const item = {
    PK: "VALIDACIONES_GLOBAL",
    SK: `VAL#${id}`,
    id,
    userId,
    fecha,
    data,
    entity_type: "validacion",
  };
  await db.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

async function listarValidaciones() {
  const res = await db.send(new ScanCommand({ TableName: TABLE_NAME }));
  return (res.Items || []).filter((i) => i.entity_type === "validacion");
}

async function eliminarValidacion(id) {
  await db.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: "VALIDACIONES_GLOBAL", SK: `VAL#${id}` },
    })
  );
}

// ─── VALIDACIÓN DE API KEY ────────────────────────────────────────────────────
// La key se configura como variable de entorno API_KEY en cada Lambda.
// El frontend la envía en el header "x-api-key".
// Retorna null si es válida, o un objeto de respuesta 401 si no lo es.

function checkApiKey(event) {
  const expectedKey = process.env.API_KEY;

  // Si no hay key configurada en la Lambda, dejamos pasar (útil en local sin env)
  if (!expectedKey) return null;

  const receivedKey =
    event.headers?.["x-api-key"] ||
    event.headers?.["X-Api-Key"] ||
    event.headers?.["X-API-Key"];

  if (!receivedKey || receivedKey !== expectedKey) {
    return err("API key inválida o ausente.", 401);
  }

  return null; // key válida → continuar
}

// ─── HELPERS DE RESPUESTA HTTP ────────────────────────────────────────────────

function ok(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With,x-api-key",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function err(message, statusCode = 400) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With,x-api-key",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    },
    body: JSON.stringify({ detail: message }),
  };
}

// Elimina campos internos de DynamoDB antes de devolver al frontend
function sanitizeUser(user) {
  if (!user) return null;
  const { password, PK, SK, entity_type, ...safe } = user;
  return safe;
}

function sanitizeValidacion(v) {
  if (!v) return null;
  const { PK, SK, entity_type, ...safe } = v;
  return safe;
}

module.exports = {
  db,
  TABLE_NAME,
  // clientes DynamoDB para uso directo en handlers
  PutCommand,
  ScanCommand,
  // usuarios
  crearUsuario,
  obtenerUsuario,
  listarUsuarios,
  eliminarUsuario,
  actualizarPerfilUsuario,
  // validaciones
  crearValidacion,
  listarValidaciones,
  eliminarValidacion,
  // helpers
  ok,
  err,
  checkApiKey,
  sanitizeUser,
  sanitizeValidacion,
};
