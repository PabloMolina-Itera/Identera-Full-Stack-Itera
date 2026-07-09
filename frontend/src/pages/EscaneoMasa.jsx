import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScanner } from '../hooks/useScanner';
import { toastService } from '../components/toastService';
import './EscaneoMasa.css';

export default function EscaneoMasa() {
  const navigate = useNavigate();
  const [modo, setModo] = useState('camara'); // 'camara' | 'lote'
  const [logs, setLogs] = useState([]);
  const [successCount, setSuccessCount] = useState(0);
  const [procesandoLote, setProcesandoLote] = useState(false);
  const [progresoLote, setProgresoLote] = useState(0);

  const { 
    escaneando, 
    errorCamara, 
    tooltipText, 
    iniciarCamara, 
    detenerCamara, 
    escanearImagen 
  } = useScanner('masa-reader', { fps: 20 });

  const lastScannedRef = useRef({ text: null, time: 0 });

  const onScanSuccess = useCallback(async (decodedText) => {
    const now = Date.now();
    // Prevenir spam del mismo QR (Enfriamiento de 2.5 segundos)
    if (
      lastScannedRef.current.text === decodedText &&
      now - lastScannedRef.current.time < 2500
    ) {
      return;
    }
    
    lastScannedRef.current = { text: decodedText, time: now };

    try {
      const payload = JSON.parse(decodedText);
      const codigo = payload.codigoValidador;

      if (!codigo || payload.tipo !== 'carnet') throw new Error('QR No válido');

      // El QR contiene todos los datos del carnet; los usamos directamente
      if (payload.nombre) {
        const newLog = {
          id: crypto.randomUUID(),
          nombre: payload.nombre,
          hora: new Date().toLocaleTimeString(),
          status: 'success'
        };
        setLogs(prev => [newLog, ...prev.slice(0, 19)]);
        setSuccessCount(prev => prev + 1);
        toastService.success(`¡Validado: ${payload.nombre}! (Escaneado con éxito, pasa al siguiente)`);
      } else {
        const newLog = {
          id: crypto.randomUUID(),
          nombre: `Carnet sin nombre: #${codigo}`,
          hora: new Date().toLocaleTimeString(),
          status: 'error'
        };
        setLogs(prev => [newLog, ...prev.slice(0, 19)]);
        toastService.error('QR con datos incompletos.');
      }
    } catch (err) {
      console.warn('QR ignorado: formato incorrecto');
    }
  }, []);

  const handleStartCamera = () => {
    lastScannedRef.current = { text: null, time: 0 }; // Resetear enfriamiento al iniciar
    iniciarCamara(onScanSuccess);
  };

  const handleBatchFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.length > 50) {
      toastService.error('Límite de 50 imágenes por lote superado.');
      return;
    }

    setProcesandoLote(true);
    setProgresoLote(0);
    let count = 0;

    for (const file of files) {
      try {
        await escanearImagen(file, (text) => {
          onScanSuccess(text);
          count++;
        }, () => {
           setLogs(prev => [{
             id: crypto.randomUUID(),
             nombre: `Error: ${file.name}`,
             hora: new Date().toLocaleTimeString(),
             status: 'error'
           }, ...prev.slice(0, 19)]);
        });
      } catch (err) {
        console.error('Error procesando archivo', err);
      }
      setProgresoLote(Math.round(((files.indexOf(file) + 1) / files.length) * 100));
    }

    setProcesandoLote(false);
    toastService.success(`Procesamiento completado. ${count} válidos.`);
    e.target.value = '';
  };

  return (
    <div className="escaneo-masa page-wrap">
      <div className="escaneo-masa-grid">
        <section className="scanner-section">
          <header className="premium-header">
            <h1>Escaneo de Eventos</h1>
            <p>Gestiona el acceso masivo de forma eficiente y rápida.</p>
          </header>

          <div className="validar-tabs">
            <button
              type="button"
              className=""
              onClick={() => { detenerCamara(); navigate('/validar'); }}
            >
              Validar
            </button>
            <button
              type="button"
              className={modo === 'camara' ? 'active' : ''}
              onClick={() => { setModo('camara'); detenerCamara(); }}
            >
              Validar Masivo
            </button>
          </div>

          <div className="main-scanner-area">
            {modo === 'camara' && (
              <div className={`camara-wrap ${escaneando ? 'active' : ''}`}>
                <div id="masa-reader" className="glass"></div>
                {!escaneando && (
                  <div className="camara-placeholder card glass">
                    <span className="icon">📷</span>
                    <h3>Listo para escanear</h3>
                    <p>Activa la cámara para validación continua.</p>
                    <button className="btn primary" onClick={handleStartCamera}>
                      Activar Cámara
                    </button>
                  </div>
                )}
                {escaneando && (
                  <>
                    <div className="scanner-overlay-masa">
                      <div className="target-box"></div>
                      <div className="scan-tooltip">{tooltipText}</div>
                    </div>
                    <button className="btn btn-stop masa-stop" onClick={detenerCamara}>
                      Detener
                    </button>
                  </>
                )}
                {errorCamara && <p className="error-msg">{errorCamara}</p>}
              </div>
            )}

            {modo === 'lote' && (
              <div className="lote-wrap card glass">
                <div className="lote-header">
                  <span className="icon">📦</span>
                  <h3>Carga Masiva</h3>
                  <p>Sube hasta 50 imágenes de carnet de una vez.</p>
                </div>
                
                <label className={`upload-dropzone ${procesandoLote ? 'busy' : ''}`}>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    onChange={handleBatchFiles}
                    disabled={procesandoLote}
                  />
                  {procesandoLote ? (
                    <div className="progress-ui">
                      <div className="spinner"></div>
                      <span>Procesando lote... {progresoLote}%</span>
                    </div>
                  ) : (
                    <span>Seleccionar o soltar imágenes aquí</span>
                  )}
                </label>
              </div>
            )}
          </div>

          <div className="masa-stats">
            <div className="counter-box glass">
              <span className="label">Validados en esta sesión</span>
              <span className="value">{successCount}</span>
            </div>
          </div>
        </section>

        <section className="session-logs card glass">
          <div className="logs-header">
            <h2>Registro de Sesión</h2>
            {logs.length > 0 && (
              <button onClick={() => { setLogs([]); setSuccessCount(0); }} className="btn-link">Reiniciar</button>
            )}
          </div>
          <div className="logs-list">
            {logs.map(log => (
              <div key={log.id} className={`log-item ${log.status}`}>
                <div className="log-status-dot"></div>
                <div className="log-info">
                  <span className="log-name">{log.nombre}</span>
                  <span className="log-time">{log.hora}</span>
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="empty-logs">
                <p>Esperando datos...</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
