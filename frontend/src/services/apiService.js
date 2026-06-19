/**
 * Servicio de Carnets integrado con AWS API Gateway (Lambda).
 * La información de los carnets vive en DynamoDB a través de las Lambdas.
 */

import { authService } from './authService';

const API_URL = import.meta.env.VITE_API_URL ?? '';
const API_KEY = import.meta.env.VITE_API_KEY || null;

function headers(custom = {}, method = 'GET') {
  const h = { ...custom };
  // Solo incluir Content-Type en métodos que llevan cuerpo
  if (method !== 'GET' && method !== 'HEAD') {
    h['Content-Type'] = 'application/json';
  }
  if (API_KEY) h['x-api-key'] = API_KEY;
  return h;
}

// Dedup de requests en vuelo: evita llamadas repetidas simultáneas
const _inflight = new Map();

function dedup(key, factory) {
  if (_inflight.has(key)) return _inflight.get(key);
  const promise = factory().finally(() => _inflight.delete(key));
  _inflight.set(key, promise);
  return promise;
}

export const apiService = {

  getValidaciones(userId = null) {
    const url = `${API_URL}/validaciones${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`;
    return dedup(url, () =>
      fetch(url, { headers: headers({}, 'GET') }).then(res => {
        if (!res.ok) throw new Error("Fallo al conectarse al Backend");
        return res.json();
      })
    );
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
      headers: headers({}, 'POST'),
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Error al guardar el carnet');
    return res.json();
  },

  async deleteValidacion(id) {
    const res = await fetch(`${API_URL}/validaciones/${id}`, {
      method: 'DELETE',
      headers: headers({}, 'DELETE')
    });

    if (!res.ok) throw new Error('Fallo al borrar validación');
    return res.json();
  },

  async clearValidaciones() {
    const res = await fetch(`${API_URL}/validaciones/all/clear`, {
      method: 'DELETE',
      headers: headers({}, 'DELETE')
    });

    if (!res.ok) throw new Error('Error limpiando validaciones');
  },

  async regenerarQR() {
    const user = authService.getCurrentUser();

    if (!user?.id) {
      throw new Error('Usuario no autenticado');
    }

    const res = await fetch(`${API_URL}/qr/regenerar`, {
      method: 'POST',
      headers: headers({}, 'POST'),
      body: JSON.stringify({ userId: user.id })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error regenerando QR');
    }

    return res.json();
  },

  // Alias usado por MisCarnets.jsx → handleRegenerateQR
  // Edita campos del carnet vía PATCH /carnets/{id}
  async updateValidacion(carnetId, data) {
    return this.editarCarnet(carnetId, data);
  },

  async editarCarnet(carnetId, data) {
    if (!carnetId) {
      throw new Error('Falta el ID del carnet');
    }

    const res = await fetch(`${API_URL}/carnets/${carnetId}`, {
      method: 'PATCH',
      headers: headers({}, 'PATCH'),
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
      headers: headers({}, 'POST'),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error creando carnet');
    }

    return res.json();
  }

};
