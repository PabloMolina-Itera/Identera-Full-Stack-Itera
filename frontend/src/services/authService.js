/**
 * Servicio de autenticación integrado con AWS API Gateway (Lambda).
 * Maneja el estado de la sesión local (quién soy) mediante fetch
 * hacia la API desplegada en AWS.
 */

const API_URL = import.meta.env.VITE_API_URL ?? '';
const API_KEY = import.meta.env.VITE_API_KEY || null;
const AUTH_KEY = 'identera-auth-user';

function headers(custom = {}) {
  const h = { 'Content-Type': 'application/json', ...custom };
  if (API_KEY) h['x-api-key'] = API_KEY;
  return h;
}

export const authService = {
  // --- Sesión Local ---

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

  // Verifica contra el backend que la sesión y el rol sigan vigentes.
  // Si el rol cambió en DynamoDB, fuerza logout para que el token local no se use.
  async verifySession() {
    try {
      const local = this.getCurrentUser();
      if (!local?.email) return false;

      const res = await fetch(`${API_URL}/usuarios`, { headers: headers() });
      if (!res.ok) return false;

      const users = await res.json();
      const fresh = users.find(u => u.id === local.id);

      if (!fresh) return false;
      if (fresh.status === 'disabled') return false;
      if (fresh.role !== local.role) {
        // Rol cambiado — invalidar sesión local
        this.logout();
        return false;
      }
      return true;
    } catch {
      // Si falla la red, permitir continuar con la sesión local
      return true;
    }
  },

  // --- Auth ---

  async login(email, password) {
    const resp = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, password })
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Error de conexión');
    }

    const sessionUser = await resp.json();
    sessionUser.lastLogin = new Date().toISOString();
    localStorage.setItem(AUTH_KEY, JSON.stringify(sessionUser));
    return sessionUser;
  },

  // --- Usuarios (Admin) ---

  async getAllUsers() {
    const res = await fetch(`${API_URL}/usuarios`, { headers: headers() });
    if (!res.ok) throw new Error("Fallo al obtener usuarios del backend.");
    return res.json();
  },

  async createUser(email, password, name, role) {
    const res = await fetch(`${API_URL}/usuarios`, {
      method: "POST",
      headers: headers(),
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
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error creando usuario en Backend");
    }
    return res.json();
  },

  async updateUserProfile(email, newEmail, newName, newPassword) {
    const payload = { email: newEmail, name: newName };
    if (newPassword) payload.password = newPassword;

    const res = await fetch(`${API_URL}/usuarios/${encodeURIComponent(email)}/profile`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error actualizando perfil del usuario");
    }
    return res.json();
  },

  async updateUserStatus(email, newStatus) {
    const res = await fetch(`${API_URL}/usuarios/${encodeURIComponent(email)}/status`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "No se pudo cambiar el estado.");
    }
    return true;
  },

  async updateUserRole(email, newRole) {
    const res = await fetch(`${API_URL}/usuarios/${encodeURIComponent(email)}/role`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ role: newRole })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "No se pudo cambiar el rol.");
    }
    return true;
  },

  async deleteUser(email) {
    const res = await fetch(`${API_URL}/usuarios/${encodeURIComponent(email)}`, {
      method: "DELETE",
      headers: headers()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "No se pudo borrar el usuario.");
    }
    return true;
  }
};
