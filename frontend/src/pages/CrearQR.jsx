import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import html2canvas from 'html2canvas';
import CarnetCard from '../components/CarnetCard';
import { apiService } from '../services/apiService';
import { authService } from '../services/authService';
import { toastService } from '../components/toastService';
import { generateCodigoValidador } from '../utils/carnetUtils';
import './CrearQR.css';

export default function CrearQR() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const queryUserId = searchParams.get('userId');
  const queryNombre = searchParams.get('nombre');

  const currentUser = useMemo(() => authService.getCurrentUser(), []);
  const isReadOnly = currentUser?.role === 'USUARIO';
  const targetUserId = (currentUser?.role === 'ADMINISTRADOR' && queryUserId) ? queryUserId : currentUser?.id;

  const [isEditing, setIsEditing] = useState(false);
  const [nombre, setNombre] = useState(queryNombre || '');
  const [usersList, setUsersList] = useState([]);
  const [searchEmail, setSearchEmail] = useState('');

  useEffect(() => {
    if (currentUser?.role === 'ADMINISTRADOR') {
      authService.getAllUsers().then(list => setUsersList(list));
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'ADMINISTRADOR' && targetUserId) {
      if (targetUserId === currentUser.id) setSearchEmail(currentUser.email);
      else {
        const match = usersList.find(u => u.id === targetUserId);
        if (match) setSearchEmail(match.email);
      }
    }
  }, [targetUserId, usersList, currentUser]);

  const [cargo, setCargo] = useState('');
  const [arl, setArl] = useState('');
  const [eps, setEps] = useState('');
  const [cedula, setCedula] = useState('');
  const [foto, setFoto] = useState(null);
  const [codigoValidador, setCodigoValidador] = useState(generateCodigoValidador());

  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    async function checkExisting() {
      // Resetear formulario antes de cargar datos del nuevo usuario
      setNombre('');
      setCargo('');
      setArl('');
      setEps('');
      setCedula('');
      setFoto(null);
      setIsEditing(false);
      setDataLoaded(false);

      if (currentUser && targetUserId) {
        const data = await apiService.getValidaciones(targetUserId);
        if (data && data.length > 0) {
          const c = data[0].data;
          setNombre(c.nombre !== '—' ? c.nombre : '');
          setCargo(c.cargo !== '—' ? c.cargo : '');
          setArl(c.arl !== '—' ? c.arl : '');
          setEps(c.eps !== '—' ? c.eps : '');
          setCedula(c.cedula !== '—' ? c.cedula : '');
          setCodigoValidador(c.codigoValidador);
          if (c.foto) setFoto(c.foto);
          setIsEditing(true);
        }
      }
      setDataLoaded(true);
    }
    checkExisting();
  }, [targetUserId]);

  // 2. Se prepara el texto que irá dentro del dibujo del QR.
  // Cada vez que 'codigoValidador' cambia, este payload se recrea.
  const payload = useMemo(() => {
    // El QR contiene los datos de texto del carnet para validación sin backend.
    // La foto se excluye para no exceder el límite de tamaño del QR.
    const qrData = {
      tipo: 'carnet',
      codigoValidador: codigoValidador,
      nombre: nombre || '',
      cargo: cargo || '',
      arl: arl || '',
      eps: eps || '',
      cedula: cedula || '',
    };
    return JSON.stringify(qrData);
  }, [codigoValidador, nombre, cargo, arl, eps, cedula]);

  const handleRegenerarCodigo = () => {
    // Al setear un nuevo valor aleatorio, React vuelve a calcular el 'payload' y el dibujo cambia
    setCodigoValidador(generateCodigoValidador());
  };

  const datos = {
    nombre: nombre || '—',
    cargo: cargo || '—',
    arl: arl || '—',
    eps: eps || '—',
    cedula: cedula || '—',
    codigoValidador,
    foto,
  };

  const carnetRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (dataLoaded && datos.nombre !== '—' && datos.nombre.length > 1) {
        if (currentUser && targetUserId) {
          const targetRole = (targetUserId === currentUser?.id) ? currentUser.role : 'USUARIO';
          apiService.saveValidacion(datos, targetUserId, targetRole);
        }
      }
    }, 1000); // Debounce de 1 segundo para evitar saturar o corromper la BD
    
    return () => clearTimeout(timer);
  }, [JSON.stringify(datos), dataLoaded, targetUserId, currentUser]);

  const handleDescargar = async () => {
    if (!carnetRef.current) return;
    try {
      const canvas = await html2canvas(carnetRef.current, {
        backgroundColor: null,
        scale: 2, // Mejor resolución
      });
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Carnet_${datos.codigoValidador}.png`;
      link.href = url;
      link.click();
    } catch (err) {
      console.error('Error al generar la imagen', err);
    }
  };

  return (
    <div className="crear-qr page-wrap">
      <div className="crear-qr-inner">
        <h1 className="page-title">{isEditing ? 'Editar tu carnet' : 'Crear carnet para eventos'}</h1>
        <p className="page-desc">
          {isEditing
            ? 'Actualiza tus datos o regenera tu código QR. Los cambios se guardarán automáticamente.'
            : 'Completa los datos de la persona. Se generará un carnet identificador con QR único.'}
        </p>

        <div className="crear-qr-grid">
          <section className="crear-qr-form card">
            {currentUser?.role === 'ADMINISTRADOR' && (
              <div className="admin-user-selector" style={{ marginBottom: '1.5rem', padding: '1.2rem', backgroundColor: 'rgba(91, 108, 249, 0.1)', borderLeft: '4px solid #5b6cf9', borderRadius: '4px' }}>
                <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🛡️</span> Asignar carnet a otro usuario
                </h3>
                <label style={{ marginBottom: 0 }}>
                  <span style={{ fontSize: '0.9rem', opacity: 0.8, display: 'block', marginBottom: '0.5rem' }}>
                    Selecciona el correo del usuario para enlazar su cuenta con este carnet de forma automática.
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      list="user-emails-datalist"
                      placeholder="Escribe para buscar un correo..."
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const match = usersList.find(u => u.email.toLowerCase() === searchEmail.toLowerCase());
                          if (match && match.id !== currentUser.id) {
                            navigate(`/crear?userId=${match.id}&nombre=${encodeURIComponent(match.name || '')}`);
                          } else if (searchEmail.toLowerCase() === currentUser.email.toLowerCase()) {
                            navigate('/crear');
                          }
                        }
                      }}
                      style={{ flex: 1, padding: '0.8rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '1rem' }}
                    />
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => {
                        const match = usersList.find(u => u.email.toLowerCase() === searchEmail.toLowerCase());
                        if (match && match.id !== currentUser.id) {
                          navigate(`/crear?userId=${match.id}&nombre=${encodeURIComponent(match.name || '')}`);
                        } else if (searchEmail.toLowerCase() === currentUser.email.toLowerCase()) {
                          navigate('/crear');
                        }
                      }}
                      style={{ padding: '0.8rem 1.2rem', whiteSpace: 'nowrap', fontSize: '0.9rem' }}
                    >
                      Asignar
                    </button>
                  </div>
                  {searchEmail && (() => {
                    const sugerencias = usersList.filter(u =>
                      u.email.toLowerCase().includes(searchEmail.toLowerCase()) &&
                      u.email.toLowerCase() !== searchEmail.toLowerCase()
                    ).slice(0, 5);
                    if (sugerencias.length === 0) return null;
                    return (
                      <div style={{ marginTop: '0.4rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {sugerencias.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              if (u.id !== currentUser.id) {
                                navigate(`/crear?userId=${u.id}&nombre=${encodeURIComponent(u.name || '')}`);
                              } else {
                                navigate('/crear');
                              }
                            }}
                            style={{
                              padding: '0.3rem 0.7rem',
                              fontSize: '0.8rem',
                              borderRadius: '20px',
                              border: '1px solid rgba(91,108,249,0.3)',
                              background: 'rgba(91,108,249,0.1)',
                              color: 'var(--primary)',
                              cursor: 'pointer'
                            }}
                          >
                            {u.email}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </label>
                <datalist id="user-emails-datalist">
                  <option value={currentUser.email}>Mi Carnet Propio (Administrador)</option>
                  {usersList.filter(u => u.id !== currentUser.id).map(u => (
                    <option key={u.id} value={u.email}>{u.name}</option>
                  ))}
                </datalist>
              </div>
            )}

            <h2>Datos de la persona</h2>
            <label>
              Nombre completo
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. María García"
                disabled={isReadOnly}
              />
            </label>
            <label>
              Cargo / Rol en el evento
              <input
                type="text"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Ej. Organizador, Invitado, Prensa"
                disabled={isReadOnly}
              />
            </label>
            <div className="input-group">
              <label>ARL</label>
              <input
                type="text"
                placeholder="Ej. Sura"
                value={arl}
                onChange={(e) => setArl(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            
            <div className="input-group">
              <label>EPS</label>
              <input
                type="text"
                placeholder="Ej. Sanitas"
                value={eps}
                onChange={(e) => setEps(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <label>
              Cédula / Documento
              <input
                type="text"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="Ej. 12345678"
                disabled={isReadOnly}
              />
            </label>
            <label>
              Foto del carnet (Opcional)
              <input
                type="file"
                accept="image/*"
                disabled={isReadOnly}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) {
                    setFoto(null);
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const img = new Image();
                    img.onload = () => {
                      const canvas = document.createElement('canvas');
                      const MAX_SIZE = 150;
                      let width = img.width;
                      let height = img.height;
                      if (width > height) {
                        if (width > MAX_SIZE) {
                          height *= MAX_SIZE / width;
                          width = MAX_SIZE;
                        }
                      } else {
                        if (height > MAX_SIZE) {
                          width *= MAX_SIZE / height;
                          height = MAX_SIZE;
                        }
                      }
                      canvas.width = width;
                      canvas.height = height;
                      const ctx = canvas.getContext('2d');
                      ctx.drawImage(img, 0, 0, width, height);
                      setFoto(canvas.toDataURL('image/webp', 0.8));
                    };
                    img.src = ev.target.result;
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <span className="hint">Se optimizará automáticamente para ocupar poco espacio.</span>
            </label>
            <label>
              Código validador
              <div className="codigo-validador-row">
                <input
                  type="text"
                  value={codigoValidador}
                  onChange={(e) => setCodigoValidador(e.target.value.toUpperCase().slice(0, 8))}
                  placeholder="XXXXXXXX"
                  className="codigo-input"
                  disabled={isReadOnly}
                />
              </div>
              <span className="hint">Único por persona. Sirve para validar el carnet en el evento.</span>
            </label>
          </section>

          <section className="crear-qr-preview card">
            <h2>Carnet identificador</h2>
            <p className="preview-hint top">Con este QR se valida la identidad del Iterante.</p>

            <div className="carnet-preview" ref={carnetRef}>
              <CarnetCard datos={datos} payload={payload} />
            </div>

            <div className="preview-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <button 
                type="button" 
                className="btn outline" 
                onClick={(e) => {
                  if (window.confirm('¿Deseas regenerar tu código QR? Si tienes validaciones vinculadas al antiguo, podrías perder sincronía temporalmente.')) {
                    handleRegenerarCodigo();
                  }
                }}
                style={{ width: '100%', borderColor: '#5b6cf9', color: '#5b6cf9' }}
              >
                🔄 Regenerar Código QR
              </button>
              <button type="button" className="btn primary" onClick={handleDescargar}>
                ⬇ Descargar imagen
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
