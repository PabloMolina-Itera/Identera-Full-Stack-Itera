import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CarnetCard from '../components/CarnetCard';
import { apiService } from '../services/apiService';
import { authService } from '../services/authService';
import { useScanner } from '../hooks/useScanner';
import { formatearFecha } from '../utils/carnetUtils';
import './Validar.css';

const MAX_GUARDADOS = 50;
const LS_KEY = 'identera_validaciones';

function leerValidaciones() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function guardarValidaciones(lista) {
  const limitadas = lista.slice(0, MAX_GUARDADOS);
  localStorage.setItem(LS_KEY, JSON.stringify(limitadas));
  return limitadas;
}

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
  const [arrastrando, setArrastrando] = useState(false);
  const scanLockRef = useRef(false);
  const navigate = useNavigate();

  const user = authService.getCurrentUser();

  useEffect(() => {
    setValidacionesGuardadas(leerValidaciones());
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
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    try {
      const payload = JSON.parse(decodedText);
      if (payload.tipo !== 'carnet' || !payload.codigoValidador) {
        setResultado({ ok: false, error: 'No es un carnet válido de Identera.' });
        return;
      }

      // QR nuevo: contiene todos los datos embebidos (excepto la foto, que se
      // excluye del QR por tamaño). Hay que buscarla en localStorage o API.
      if (payload.nombre) {
        let dataConFoto = { ...payload };

        // 1) Intentar recuperar la foto desde localStorage
        const locales = leerValidaciones();
        const matchLocal = locales.find(
          v => v?.data?.codigoValidador === payload.codigoValidador && v?.data?.foto
        );
        if (matchLocal) {
          dataConFoto.foto = matchLocal.data.foto;
        } else {
          // 2) Fallback: buscar la foto en la API
          try {
            // Si el QR incluye userId, filtramos para reducir la respuesta
            const todos = await apiService.getValidaciones(payload.userId || null);
            const matchApi = todos.find(
              c => c?.data?.codigoValidador === payload.codigoValidador && c?.data?.foto
            );
            if (matchApi) {
              dataConFoto.foto = matchApi.data.foto;
            } else {
              console.warn('[Validar] Carnet encontrado en API pero sin foto guardada. ¿Se guardó correctamente al crear el carnet?');
            }
          } catch (err) {
            console.error('[Validar] No se pudo recuperar la foto desde la API:', err.message || err);
          }
        }

        setResultado({ ok: true, data: dataConFoto, userId: payload.userId });
        detenerCamara();
        return;
      }

      // QR antiguo (solo codigoValidador): buscar en localStorage primero
      const locales = leerValidaciones();
      const matchLocal = locales.find(v => v?.data?.codigoValidador === payload.codigoValidador);
      if (matchLocal && matchLocal.data.nombre) {
        setResultado({ ok: true, data: matchLocal.data, userId: matchLocal.userId });
        detenerCamara();
        return;
      }

      // Fallback: buscar en API (QR antiguo aún no regenerado)
      try {
        const todos = await apiService.getValidaciones();
        const matchApi = todos.find(c => c?.data?.codigoValidador === payload.codigoValidador);
        if (matchApi && matchApi.data.nombre) {
          setResultado({ ok: true, data: matchApi.data, userId: matchApi.userId });
          detenerCamara();
          return;
        }
      } catch (err) {
        console.error('[Validar] No se pudo consultar la API para QR antiguo:', err.message || err);
      }

      setResultado({ ok: false, error: `Carnet #${payload.codigoValidador} no encontrado. Pide a la persona que regenere su QR desde Mis Carnets.` });
    } catch {
      setResultado({ ok: false, error: 'El QR no contiene un formato reconocido.' });
    } finally {
      setTimeout(() => { scanLockRef.current = false; }, 1500);
    }
  }, [detenerCamara]);

  const handleStartCamera = () => {
    setResultado(null);
    setGuardado(false);
    scanLockRef.current = false;
    iniciarCamara(onScanSuccess);
  };

  const procesarArchivo = async (file) => {
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
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) procesarArchivo(file);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setArrastrando(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setArrastrando(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setArrastrando(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) procesarArchivo(file);
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

    const actuales = leerValidaciones();
    const next = guardarValidaciones([nueva, ...actuales]);
    setValidacionesGuardadas(next);
    setGuardado(true);
    setGuardando(false);
  };

  const borrarValidaciones = () => {
    localStorage.removeItem(LS_KEY);
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
              className={`upload-zone${arrastrando ? ' upload-zone-dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input type="file" accept="image/*" onChange={handleFile} className="upload-input" />
              <svg className="upload-icon" viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="upload-text">{arrastrando ? '¡Suelta la imagen aquí!' : 'Arrastra una imagen o haz clic aquí'}</span>
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
