import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { authService } from '../services/authService';
import { toastService } from '../components/toastService';
import CarnetCard from '../components/CarnetCard';
import { generateCodigoValidador } from '../utils/carnetUtils';
import './MisCarnets.css';

export default function MisCarnets() {
  const [carnets, setCarnets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const user = authService.getCurrentUser();
      if (user) {
        const data = await apiService.getValidaciones(user.role === 'ADMINISTRADOR' ? null : user.id);
        setCarnets(data);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este carnet del historial?')) return;
    
    await apiService.deleteValidacion(id);
    const updated = carnets.filter(c => c.id !== id);
    setCarnets(updated);
    toastService.success('Carnet eliminado con éxito');
  };

  const handleRegenerateQR = async (item) => {
    if (!window.confirm('¿Quieres regenerar el código QR de este carnet? Los datos del usuario se mantendrán iguales.')) return;
    
    try {
      const nuevoCodigo = generateCodigoValidador();
      const updatedData = { ...item.data, codigoValidador: nuevoCodigo };
      const updatedItem = await apiService.editarCarnet(item.id, updatedData);
      
      const updatedCarnets = carnets.map(c => c.id === item.id ? updatedItem : c);
      setCarnets(updatedCarnets);
      toastService.success('Código QR regenerado con éxito');
    } catch (error) {
      console.error('Error al regenerar:', error);
      toastService.error('Hubo un error al regenerar el código QR');
    }
  };

  if (loading) return <div className="page-wrap"><p>Cargando historial...</p></div>;

  return (
    <div className="mis-carnets page-wrap">
      <header className="page-header">
        <h1 className="page-title">Mi Carnet</h1>
        <p className="page-desc">Aquí puedes ver y descargar tu carnet generado para el evento.</p>
      </header>

      {carnets.length === 0 ? (
        <div className="empty-history card glass">
          <span className="empty-icon">📂</span>
          <h3>Sin carnet</h3>
          <p>Aún no has generado tu carnet para este evento.</p>
        </div>
      ) : (
        <div className="carnets-grid" style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          justifyContent: 'center', 
          gap: '2rem',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {carnets.map((item) => {
            try {
              if (!item || !item.data) return null;
              const { data, fecha, id } = item;
              return (
                <div key={id} className="carnet-item-card glass">
                  <div className="carnet-miniature">
                    <CarnetCard
                      datos={data}
                      payload={JSON.stringify({
                        tipo: 'carnet',
                        codigoValidador: data?.codigoValidador || '---',
                        nombre: data?.nombre || '',
                        cargo: data?.cargo || '',
                        arl: data?.arl || '',
                        eps: data?.eps || '',
                        cedula: data?.cedula || '',
                      })}
                    />
                  </div>
                  <div className="carnet-info">
                    <h3>{data?.nombre || 'Sin nombre'}</h3>
                    <p className="cargo-tag">{data?.cargo || 'Colaborador'}</p>
                    <div className="meta">
                      <span>🆔 {data?.codigoValidador || '---'}</span>
                      <span>📅 {fecha ? new Date(fecha).toLocaleDateString() : '---'}</span>
                    </div>
                    <div className="actions" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                      <button 
                        onClick={() => handleRegenerateQR(item)} 
                        className="btn primary" 
                        title="Regenerar tu código de seguridad rápido"
                        style={{ flex: 1, padding: '8px', fontSize: '14px', justifySelf: 'stretch' }}
                      >
                        🔄 Regenerar QR
                      </button>
                      <button 
                        onClick={() => handleDelete(id)} 
                        className="btn secondary" 
                        title="Eliminar carnet para crear uno nuevo"
                        style={{ padding: '8px', fontSize: '14px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              );
            } catch (err) {
              console.error('Error renderizando carnet individual:', err);
              return null;
            }
          })}
        </div>
      )}
    </div>
  );
}
