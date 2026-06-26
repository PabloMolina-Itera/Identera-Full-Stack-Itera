/**
 * identera-lambda-validaciones
 *
 * Rutas manejadas (API Gateway REST — el path llega sin el stage "/prod"):
 *
 *   GET    /validaciones                 → lista carnets (filtra por ?userId=)
 *   POST   /validaciones?role=USUARIO    → crea / sobreescribe carnet
 *   DELETE /validaciones/{id}            → borra un carnet por id
 *
 * Comportamiento idéntico al endpoint Python (main.py) original.
 */

"use strict";

const {
  crearValidacion,
  listarValidaciones,
  eliminarValidacion,
  listarUsuarios,
  PutCommand,
  db,
  TABLE_NAME,
  ok,
  err,
  checkApiKey,
  sanitizeValidacion,
} = require("./shared/db");

// ─── Utilidad: extrae segmentos del path ignorando el stage de API GW ─────────
// API GW REST puede mandar  "/validaciones/all/clear"  o  "/prod/validaciones/…"
// Normalizamos quitando el primer segmento si es el nombre del stage.
function getSegments(event) {
  const raw = event.path || event.rawPath || "/";
  // Quita barras iniciales y parte en segmentos
  const parts = raw.replace(/^\/+/, "").split("/");
  // Si el primer segmento es el stage ("prod", "dev", etc.) lo saltamos
  const knownStages = ["prod", "dev", "staging"];
  if (knownStages.includes(parts[0])) parts.shift();
  return parts;
  // Ej: ["validaciones"]  |  ["validaciones","all","clear"]  |  ["validaciones","abc-123"]
}

// ─── Handler principal ─────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const method   = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();
  const segments = getSegments(event);
  // segments[0] = "validaciones"
  // segments[1] = undefined | "all" | "<id>"
  // segments[2] = undefined | "clear"

  console.log(`[validaciones] ${method} /${segments.join("/")}`, {
    qs: event.queryStringParameters,
    bodyPreview: event.body?.substring(0, 200),
  });

  try {

    // ── OPTIONS (preflight CORS) ───────────────────────────────────────────
    if (method === "OPTIONS") {
      return ok({});
    }

    // ── Validación de API Key ──────────────────────────────────────────────
    const keyError = checkApiKey(event);
    if (keyError) return keyError;

    // ══════════════════════════════════════════════════════════════════════
    // GET /validaciones   →   lista todos o filtra por ?userId=
    // Usado por: CrearQR.jsx, MisCarnets.jsx, AdminCarnets.jsx
    // ══════════════════════════════════════════════════════════════════════
    if (method === "GET") {
      const userId = event.queryStringParameters?.userId || null;
      const todas  = await listarValidaciones();
      const limpias = todas.map(sanitizeValidacion);
      const resultado = userId
        ? limpias.filter((v) => v.userId === userId)
        : limpias;
      return ok(resultado);
    }

    // ══════════════════════════════════════════════════════════════════════
    // POST /validaciones?role=USUARIO|ADMINISTRADOR|SEGURIDAD
    //
    // Body esperado (viene de apiService.saveValidacion):
    //   {
    //     id:     string (crypto.randomUUID del frontend),
    //     userId: string (id del usuario dueño del carnet),
    //     fecha:  string ISO,
    //     data: {
    //       nombre, cargo, arl, eps, cedula,
    //       codigoValidador,
    //       foto: null | "data:image/webp;base64,..." | "https://..."
    //     }
    //   }
    //
    // Responde: array completo de validaciones (igual que el Python)
    // ══════════════════════════════════════════════════════════════════════
    if (method === "POST") {
      const role = event.queryStringParameters?.role || "USUARIO";
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return err("Body inválido — se esperaba JSON", 400);
      }

      const { id, userId, fecha, data } = body;

      if (!id)     return err("Falta el campo 'id'", 400);
      if (!userId) return err("Falta el campo 'userId'", 400);
      if (!fecha)  return err("Falta el campo 'fecha'", 400);

      const dataNorm = data || {};

      // ── 1. Limpieza de duplicados ────────────────────────────────────
      const todas = await listarValidaciones();

      if (role === "USUARIO") {
        // El usuario solo puede tener UN carnet activo — borra los anteriores
        const viejas = todas.filter((v) => v.userId === userId);
        if (viejas.length > 0) {
          await Promise.all(viejas.map((v) => eliminarValidacion(v.id)));
        }
      } else {
        // Admin / Seguridad — evita duplicados por codigoValidador
        const codigoNuevo = dataNorm.codigoValidador;
        if (codigoNuevo) {
          const duplicados = todas.filter(
            (v) => v.data?.codigoValidador === codigoNuevo
          );
          if (duplicados.length > 0) {
            await Promise.all(duplicados.map((v) => eliminarValidacion(v.id)));
          }
        }
      }

      // ── 2. Procesamiento de foto ─────────────────────────────────────
      // En Lambda no hay filesystem. La foto ya viene redimensionada a 150px
      // desde el frontend (useImageUploader / CrearQR.jsx), por lo que pesa
      // poco (~5-15 KB en base64). La guardamos tal cual en DynamoDB.
      // Si en el futuro se quiere S3, solo cambiar esta sección.
      const fotoFinal = dataNorm.foto || null;

      const dataFinal = { ...dataNorm, foto: fotoFinal };

      // ── 3. Guardar carnet ────────────────────────────────────────────
      await crearValidacion({ id, userId, fecha, data: dataFinal });

      // ── 4. Sincronizar campos del carnet al perfil del usuario ───────
      // Replica exactamente lo que hace el Python: actualiza el item
      // USER#email con cargo, cedula, arl, eps, codigoValidador y foto.
      const usuarios = await listarUsuarios();
      const dueño = usuarios.find((u) => u.id === userId);
      if (dueño) {
        const usuarioActualizado = {
          ...dueño,
          name:            dataFinal.nombre          || dueño.name,
          cargo:           dataFinal.cargo           || "—",
          cedula:          dataFinal.cedula          || "—",
          arl:             dataFinal.arl             || "—",
          eps:             dataFinal.eps             || "—",
          codigoValidador: dataFinal.codigoValidador || "—",
          ...(dataFinal.foto ? { foto: dataFinal.foto } : {}),
        };
        await db.send(new PutCommand({ TableName: TABLE_NAME, Item: usuarioActualizado }));
      }

      // ── 5. Devolver lista completa (igual que el Python) ─────────────
      const resultado = await listarValidaciones();
      return ok(resultado.map(sanitizeValidacion));
    }

    // ══════════════════════════════════════════════════════════════════════
    // DELETE /validaciones/{id}   →   borra un carnet, devuelve lista
    // Usado por: MisCarnets.jsx (handleDelete), AdminCarnets.jsx
    // ══════════════════════════════════════════════════════════════════════
    if (method === "DELETE" && segments[1]) {
      const id = decodeURIComponent(segments[1]);
      await eliminarValidacion(id);
      const resultado = await listarValidaciones();
      return ok(resultado.map(sanitizeValidacion));
    }

    return err(`Ruta no encontrada: ${method} /${segments.join("/")}`, 404);

  } catch (e) {
    console.error("[validaciones] Error inesperado:", e);
    return err(e.message || "Error interno del servidor", 500);
  }
};
