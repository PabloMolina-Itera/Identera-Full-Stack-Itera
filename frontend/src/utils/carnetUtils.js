/**
 * Genera un código alfanumérico aleatorio de 8 caracteres.
 * Esta función se usa tanto al crear un nuevo QR como al "Regenerar QR".
 */
export const generateCodigoValidador = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  // Si cambias el 8 por un valor mayor (ej 10 o 12), el código será más seguro y largo
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

/**
 * Recibe el contenido en texto plano del QR y lo parsea a un objeto válido.
 * Los datos del carnet viajan embebidos en el QR; no se requiere cruce con BD.
 */
export function parseCarnetPayload(text) {
  try {
    const data = JSON.parse(text);
    if (data.tipo === 'carnet' && data.codigoValidador && data.nombre) {
      return { ok: true, data };
    }
    return { ok: false, error: 'No es un carnet válido de Identera.' };
  } catch {
    return { ok: false, error: 'El QR no contiene un carnet válido.' };
  }
}

/**
 * Formato de fecha legible (DD MMM HH:MM)
 */
export const formatearFecha = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch {
    return iso;
  }
};
