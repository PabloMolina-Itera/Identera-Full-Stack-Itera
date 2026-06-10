/**
 * Servicio de autenticación 100% INTEGRADO con FastAPI (Backend)
 * Maneja el estado de la sesión local (quién soy) mediante fetch
 * hacia el puerto 3000 (SAM).
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api';
const AUTH_KEY = 'identera-auth-user';

export const authService = {
  // --- Funciones del Usuario Actual (Sesión Local) ---

  getCurrentUser() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  logout() {
    localStorage.removeItem(AUTH_KEY);
  },

  async login(email, password) {
    try {
      const resp = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData.detail || 'Error de conexión');
      }

      const sessionUser = await resp.json();
      sessionUser.lastLogin = new Date().toISOString();
      localStorage.setItem(AUTH_KEY, JSON.stringify(sessionUser));
      return sessionUser;

    } catch (e) {
      console.error("[Login] Error:", e.message);
      throw e;
    }
  },

  // --- Funciones de Administración (Llamadas Reales a AWS/FastAPI) ---

  async getAllUsers() {
    const res = await fetch(`${API_URL}/usuarios`);
    if (!res.ok) throw new Error("Fallo al obtener usuarios del backend.");
    return res.json();
  },

  async createUser(email, password, name, role) {
    const res = await fetch(`${API_URL}/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        id: crypto.randomUUID(), 
        email, 
        password, 
        name, 
        role, 
        status: "enabled" 
      })
    });
    
    if (!res.ok) {
       const err = await res.json();
       throw new Error(err.detail || "Error creando usuario en Backend");
    }
    return res.json();
  },

  async updateUserProfile(email, newEmail, newName, newPassword) {
    const payload = { email: newEmail, name: newName };
    if (newPassword) payload.password = newPassword;

    const res = await fetch(`${API_URL}/usuarios/${email}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
       const err = await res.json();
       throw new Error(err.detail || "Error actualizando perfil del usuario");
    }
    return res.json();
  },

  async updateUserStatus(email, newStatus) {
    const res = await fetch(`${API_URL}/usuarios/${email}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) {
       const err = await res.json();
       throw new Error(err.detail || "No se pudo cambiar el estado.");
    }
    return true;
  },

  async updateUserRole(email, newRole) {
    const res = await fetch(`${API_URL}/usuarios/${email}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole })
    });
    if (!res.ok) {
       const err = await res.json();
       throw new Error(err.detail || "No se pudo cambiar el rol.");
    }
    return true;
  },

  async deleteUser(email) {
    const res = await fetch(`${API_URL}/usuarios/${email}`, {
      method: "DELETE"
    });
    if (!res.ok) {
       const err = await res.json();
       throw new Error(err.detail || "No se pudo borrar el usuario.");
    }
    return true;
  }
};
