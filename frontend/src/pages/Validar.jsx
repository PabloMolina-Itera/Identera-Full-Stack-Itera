import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CarnetCard from '../components/CarnetCard';
import { apiService } from '../services/apiService';
import { authService } from '../services/authService';
import { useScanner } from '../hooks/useScanner';
import './Validar.css';

const MAX_GUARDADOS = 50;

function ResultadoInvalido({ resultado }) {
  if (!resultado) return null;
  return (
    <div className="resultado-card resultado-invalido">
      <div className="resultado-icon">✕</div>
      <h2>Carnet No Válido</h2>
      <p>{resultado.error}</p>
    </div>
  );
}

export default function Validar() {
  const [resultado, setResultado] = useState(null);
  const [validacionesGuardadas, setValidacionesGuardadas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const scanLockRef = useRef(false);
  const navigate = useNavigate();

  const user = authService.getCurrentUser();

  // Cargar validaciones guardadas desde localStorage (solo este navegador)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('identera-validaciones-guardadas');
      if (saved) setValidacionesGuardadas(JSON.parse(saved));
    } catch { /* ignorar datos corruptos */ }
  }, []);

  const readerId = 'qr-reader';

  const {
    escaneando,
    errorCamara,
    tooltipText,
    iniciarCamara,
    detenerCamara,
    escanearImagen
  } = useScanner(readerId);

  const onScanSuccess = useCallback(async (decodedText) => {
    // Evitar procesar el mismo escaneo dos veces
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    try {
      const payload = JSON.parse(decodedText);
      if (payload.tipo !== 'carnet' || !payload.codigoValidador) {
        setResultado({ ok: false, error: 'No es un carnet válido de Identera.' });
        return;
      }
      const validations = await apiService.getValidaciones();
      const carnetReal = validations.find(c => c?.data?.codigoValidador === payload.codigoValidador);
      if (carnetReal && carnetReal.data.nombre) {
        setResultado({ ok: true, data: carnetReal.data, userId: carnetReal.userId });
        detenerCamara();
      } else {
        setResultado({ ok: false, error: `Carnet #${payload.codigoValidador} no encontrado en registros válidos.` });
      }
    } catch {
      setResultado({ ok: false, error: 'El QR no contiene un formato reconocido.' });
    } finally {
      // Liberar el lock después de un breve delay para evitar rebotes
      setTimeout(() => { scanLockRef.current = false; }, 1500);
    }
  }, [detenerCamara]);

  const handleStartCamera = () => {
    setResultado(null);
    setGuardado(false);
    scanLockRef.current = false;
    iniciarCamara(onScanSuccess);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResultado(null);
    setGuardado(false);
    scanLockRef.current = true;

    await escanearImagen(
      file,
      (text) => {
        scanLockRef.current = false;
        onScanSuccess(text);
      },
      (err) => {
        scanLockRef.current = false;
        setResultado({ ok: false, error: err.message || 'No se encontró un código QR en la imagen.' });
      }
    );

    e.target.value = '';
  };

  const guardarValidacion = () => {
    if (!resultado?.ok || !resultado?.data || guardando || guardado) return;
    setGuardando(true);

    const nueva = {
      id: crypto.randomUUID(),
      userId: resultado.userId || user?.id,
      fecha: new Date().toISOString(),
      data: resultado.data
    };

    const guardadas = [nueva, ...validacionesGuardadas].slice(0, MAX_GUARDADOS);
    setValidacionesGuardadas(guardadas);
    localStorage.setItem('identera-validaciones-guardadas', JSON.stringify(guardadas));
    setGuardado(true);
    setGuardando(false);
  };

  const formatearFecha = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const borrarValidaciones = () => {
    localStorage.removeItem('identera-validaciones-guardadas');
    setValidacionesGuardadas([]);
  };

  const limpiarResultado = () => {
    setResultado(null);
    setGuardado(false);
  };

  const hayResultadoValido = resultado?.ok && resultado?.data;

  return (
    <div className="validar page-wrap">
      <h1 className="page-title">Validar carnet</h1>
      <p className="page-desc">
        Escanea el QR con la cámara o sube una imagen para verificar el carnet y su código validador.
      </p>

      <div className="validar-tabs">
        <button type="button" className="active">Validar</button>
        <button type="button" onClick={() => { detenerCamara(); navigate('/escaneo-masa'); }}>
          Validar Masivo
        </button>
      </div>

      {/* Resultado inválido */}
      {resultado && !resultado.ok && <ResultadoInvalido resultado={resultado} />}

      {/* Resultado válido: se muestra arriba y reemplaza el grid de escaneo */}
      {hayResultadoValido ? (
        <section className="resultado-valido-section card">
          <div className="resultado-valido-header">
            <h3 className="resultado-valido-title">✓ Carnet válido</h3>
            <button type="button" className="btn-close-result" onClick={limpiarResultado} title="Escanear otro">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <CarnetCard datos={resultado.data} />
          <div className="resultado-actions">
            <button
              type="button"
              className="btn primary"
              onClick={guardarValidacion}
              disabled={guardando || guardado}
            >
              {guardando ? 'Guardando...' : guardado ? '✓ Guardado' : 'Guardar en este dispositivo'}
            </button>
            <button type="button" className="btn secondary" onClick={handleStartCamera}>
              Escanear otro
            </button>
          </div>
        </section>
      ) : (
        /* Grid: Cámara + Upload — solo visible cuando NO hay resultado válido */
        <div className="validar-grid">
          <section className="validar-camara card">
            <div className="qr-scanner-wrapper">
              <div id={readerId} className="qr-reader-container" />
              {escaneando && (
                <div className="scanner-overlay">
                  <div className="scanner-tooltip">{tooltipText}</div>
                </div>
              )}
            </div>

            {!escaneando ? (
              <div className="qr-reader-placeholder">
                <p>Activa la cámara para escanear un carnet.</p>
                <button className="btn primary" onClick={handleStartCamera}>Activar Cámara</button>
              </div>
            ) : (
              <button className="btn btn-stop" onClick={detenerCamara}>Detener Cámara</button>
            )}
            {errorCamara && <p className="error-msg">{errorCamara}</p>}
          </section>

          <section className="validar-imagen card">
            <h3 className="validar-section-title">Subir imagen</h3>
            <label
              className="upload-zone"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer?.files?.[0];
                if (file && file.type.startsWith('image/')) {
                  handleFile({ target: { files: [file] } });
                }
              }}
            >
              <input type="file" accept="image/*" onChange={handleFile} className="upload-input" />
              <svg className="upload-icon" viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="upload-text">Arrastra una imagen o haz clic aquí</span>
              <span className="upload-hint">PNG, JPG o WebP con un código QR</span>
            </label>
          </section>
        </div>
      )}

      {/* Validaciones guardadas */}
      {validacionesGuardadas.length > 0 && (
        <section className="validaciones-guardadas card">
          <div className="validaciones-header">
            <h3>Validaciones guardadas ({validacionesGuardadas.length})</h3>
            <button type="button" className="btn-icon" onClick={borrarValidaciones} title="Borrar todas">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          </div>
          <p className="validaciones-hint">Se guardan solo en este navegador. Últimas {MAX_GUARDADOS}.</p>
          <div className="validaciones-grid">
            {validacionesGuardadas.map((v) => {
              if (!v || !v.data) return null;
              return (
                <div key={v.id} className="validacion-item">
                  <div className="validacion-item-header">
                    <strong>{v.data.nombre ?? '—'}</strong>
                    <span className="validacion-fecha">{formatearFecha(v.fecha)}</span>
                  </div>
                  <CarnetCard datos={v.data} />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
