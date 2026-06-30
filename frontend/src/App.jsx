import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import CrearQR from './pages/CrearQR';
import Validar from './pages/Validar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MisCarnets from './pages/MisCarnets';
import EscaneoMasa from './pages/EscaneoMasa';
import AdminDashboard from './pages/AdminDashboard';
import AdminCarnets from './pages/AdminCarnets';
import { authService } from './services/authService';

function RoleRoute({ children, allowedRoles }) {
  const user = authService.getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="login" element={<Login />} />
          
          {/* Rutas de Usuario y Admin */}
          <Route 
            path="crear" 
            element={ <RoleRoute allowedRoles={['ADMINISTRADOR', 'USUARIO']}><CrearQR /></RoleRoute> } 
          />
          <Route 
            path="mis-carnets" 
            element={ <RoleRoute allowedRoles={['ADMINISTRADOR', 'USUARIO']}><MisCarnets /></RoleRoute> } 
          />

          {/* Rutas de Seguridad y Admin */}
          <Route 
            path="validar" 
            element={ <Validar /> } 
          />
          <Route 
            path="escaneo-masa" 
            element={ <EscaneoMasa /> } 
          />

          {/* Rutas Exclusivas de Administrador */}
          <Route 
            path="dashboard" 
            element={ <RoleRoute allowedRoles={['ADMINISTRADOR']}><Dashboard /></RoleRoute> } 
          />
          <Route 
            path="admin" 
            element={ <RoleRoute allowedRoles={['ADMINISTRADOR']}><AdminDashboard /></RoleRoute> } 
          />
          <Route 
            path="admin-carnets" 
            element={ <RoleRoute allowedRoles={['ADMINISTRADOR']}><AdminCarnets /></RoleRoute> } 
          />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
