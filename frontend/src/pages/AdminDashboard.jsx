import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { toastService } from '../components/toastService';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal for new user
  const [showModal, setShowModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('USUARIO');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal for editing user
  const [editingUser, setEditingUser] = useState(null);
  const [editEmail, setEditEmail] = useState('');
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await authService.getAllUsers();
      setUsers(data);
    } catch (err) {
      toastService.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newUser = await authService.createUser(newEmail, newPassword, newName, newRole);
      
      if (newRole === 'USUARIO') {
        toastService.success('Usuario creado. Redirigiendo a crear su carnet...');
        setShowModal(false);
        setTimeout(() => {
          navigate(`/crear?userId=${newUser.id}&nombre=${encodeURIComponent(newName)}`);
        }, 1200);
      } else {
        toastService.success('Usuario creado con éxito');
        setShowModal(false);
        setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('USUARIO');
        loadUsers();
      }
    } catch (err) {
      toastService.error(err.message || 'Error al crear usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditEmail(user.email);
    setEditName(user.name);
    setEditPassword(''); // Keep blank unless they want to change it
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await authService.updateUserProfile(editingUser.email, editEmail, editName, editPassword);
      toastService.success('¡Usuario actualizado exitosamente!');
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      toastService.error(err.message || 'Error al actualizar usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (user) => {
    try {
      const newStatus = user.status === 'enabled' ? 'disabled' : 'enabled';
      await authService.updateUserStatus(user.email, newStatus);
      toastService.success(`Usuario ${newStatus === 'enabled' ? 'habilitado' : 'inhabilitado'}`);

      // Si el admin se inhabilitó a sí mismo, cerrar sesión inmediatamente
      const currentUser = authService.getCurrentUser();
      if (currentUser && user.email === currentUser.email && newStatus === 'disabled') {
        authService.logout();
        toastService.error('Te has inhabilitado. No puedes continuar.');
        setTimeout(() => navigate('/login'), 500);
        return;
      }

      loadUsers();
    } catch (err) {
      toastService.error(err.message);
    }
  };

  const changeRole = async (user, role) => {
    try {
      await authService.updateUserRole(user.email, role);
      toastService.success('Rol actualizado');

      // Si el admin se cambió su propio rol, cerrar sesión inmediatamente
      const currentUser = authService.getCurrentUser();
      if (currentUser && user.email === currentUser.email && role !== currentUser.role) {
        authService.logout();
        toastService.error('Tu rol ha cambiado. Inicia sesión de nuevo.');
        setTimeout(() => navigate('/login'), 500);
        return;
      }

      loadUsers();
    } catch (err) {
      toastService.error(err.message);
    }
  };

  if (loading) return <div className="page-wrap"><p>Cargando usuarios...</p></div>;

  return (
    <div className="admin-dashboard page-wrap">
      <header className="page-header">
        <h1 className="page-title">Gestión de Iterantes</h1>
        <p className="page-desc">Crea cuentas, asigna roles y habilita o deshabilita accesos al sistema.</p>
        <button className="btn primary new-user-btn" onClick={() => setShowModal(true)}>
          + Crear Nuevo Usuario
        </button>
      </header>

      <div className="users-table-container card glass">
        <table className="users-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td data-label="Nombre">{u.name}</td>
                <td data-label="Email">{u.email}</td>
                <td data-label="Rol">
                  <select 
                    value={u.role} 
                    onChange={(e) => changeRole(u, e.target.value)}
                    disabled={u.id === 'admin-id-123'}
                    className="role-select"
                  >
                    <option value="ADMINISTRADOR">Administrador</option>
                    <option value="USUARIO">Usuario</option>
                  </select>
                </td>
                <td data-label="Estado">
                  <span className={`status-badge ${u.status === 'enabled' ? 'active' : 'inactive'}`}>
                    {u.status === 'enabled' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td data-label="Acciones" className="actions-flex">
                  <button 
                    className={`btn-small ${u.status === 'enabled' ? 'danger' : 'success'}`}
                    onClick={() => toggleStatus(u)}
                    disabled={u.id === 'admin-id-123'}
                  >
                    {u.status === 'enabled' ? 'Inhabilitar' : 'Habilitar'}
                  </button>
                  <button 
                    className="btn-small secondary"
                    onClick={() => openEditModal(u)}
                    disabled={u.id === 'admin-id-123'}
                  >
                    Editar
                  </button>
                  <button 
                    className="btn-small danger"
                    onClick={async () => {
                      if (window.confirm('¿Seguro que deseas eliminar definitivamente este usuario?')) {
                        try {
                          await authService.deleteUser(u.email);
                          toastService.success('Usuario eliminado');
                          loadUsers();
                        } catch(err) {
                          toastService.error(err.message);
                        }
                      }
                    }}
                    disabled={u.id === 'admin-id-123'}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan="5">No hay usuarios registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass">
            <h2>Crear Nuevo Usuario</h2>
            <form onSubmit={handleCreateUser} className="admin-form">
              <label>
                Nombre
                <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej. Juan Pérez" />
              </label>
              <label>
                Email
                <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="usuario@identera.com" />
              </label>
              <label>
                Contraseña
                <input type="text" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} />
              </label>
              <label>
                Rol
                <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="ADMINISTRADOR">Administrador</option>
                  <option value="USUARIO">Usuario</option>
                </select>
              </label>
              
              <div className="modal-actions">
                <button type="button" className="btn-small secondary" onClick={() => setShowModal(false)} disabled={isSubmitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-small primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR USUARIO */}
      {editingUser && (
        <div className="modal-backdrop">
          <div className="modal-content glass">
            <h2>Editar Usuario</h2>
            <form onSubmit={handleEditUser} className="admin-form">
              <label>
                Nombre Completo
                <input type="text" required value={editName} onChange={e => setEditName(e.target.value)} placeholder="Ej. Juan Pérez" />
              </label>
              <label>
                Email (Llave de Acceso)
                <input type="email" required value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="usuario@identera.com" />
              </label>
              <label>
                Nueva Contraseña
                <input type="text" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Deja en blanco para no cambiarla" minLength={6} />
              </label>
              
              <div className="modal-actions">
                <button type="button" className="btn-small secondary" onClick={() => setEditingUser(null)} disabled={isSubmitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-small primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
