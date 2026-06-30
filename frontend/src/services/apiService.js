/**
 * Servicio de Carnets integrado con AWS API Gateway (Lambda).
 * La información de los carnets vive en DynamoDB a través de las Lambdas.
 */

import { authService } from './authService';

const API_URL = import.meta.env.VITE_API_URL ?? '';
const API_KEY = import.meta.env.VITE_API_KEY || null;

function headers(custom = {}) {
  const h = { 'Content-Type': 'application/json', ...custom };
  if (API_KEY) h['x-api-key'] = API_KEY;
  return h;
}

export const apiService = {

  async getValidaciones(userId = null) {
    let url = `${API_URL}/validaciones`;
    if (userId) {
      url += `?userId=${encodeURIComponent(userId)}`;
    }

    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error("Fallo al conectarse al Backend");
    return res.json();
  },

  async saveValidacion(data, userId, role) {
    const payload = {
      id: crypto.randomUUID(),
      userId,
      fecha: new Date().toISOString(),
      data
    };

    const res = await fetch(`${API_URL}/validaciones?role=${role || 'USUARIO'}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Error al guardar el carnet');
    return res.json();
  },

  async deleteValidacion(id) {
    const res = await fetch(`${API_URL}/validaciones/${id}`, {
      method: 'DELETE',
      headers: headers()
    });

    if (!res.ok) throw new Error('Fallo al borrar validación');
    return res.json();
  },

  async regenerarQR() {
    const user = authService.getCurrentUser();

    if (!user?.id) {
      throw new Error('Usuario no autenticado');
    }

    const res = await fetch(`${API_URL}/qr/regenerar`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ userId: user.id })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error regenerando QR');
    }

    return res.json();
  },

  async editarCarnet(carnetId, data) {
    if (!carnetId) {
      throw new Error('Falta el ID del carnet');
    }

    const res = await fetch(`${API_URL}/carnets/${carnetId}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error editando carnet');
    }

    return res.json();
  },

  async crearCarnet(data) {
    const user = authService.getCurrentUser();

    if (!user?.id) {
      throw new Error('Usuario no autenticado');
    }

    const payload = {
      id: crypto.randomUUID(),
      userId: user.id,
      fechaCreacion: new Date().toISOString(),
      ...data
    };

    const res = await fetch(`${API_URL}/carnets`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error creando carnet');
    }

    return res.json();
  }

};
