import { QRCodeSVG } from 'qrcode.react';
import './CarnetCard.css';

/**
 * Plantilla visual del carnet.
 * - datos: info de la persona (nombre, foto, cédula, etc.)
 * - payload: texto del QR. Si está vacío, es modo "Validado".
 */
export default function CarnetCard({ datos, payload = null }) {
  const nombre = datos?.nombre ?? '—';
  const cargo = datos?.cargo ?? '—';
  const arl = datos?.arl ?? '—';
  const cedula = datos?.cedula ?? datos?.documento ?? '—';
  const codigoValidador = datos?.codigoValidador ?? '—';

  // Resolver la URL de la foto sin importar el entorno (SAM, FastAPI directo, etc.)
  let fotoFinal = datos?.foto;
  if (fotoFinal && fotoFinal.startsWith('http')) {
    try {
      const fotoUrl = new URL(fotoFinal);
      const apiBase = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';
      const apiUrl = new URL(apiBase);
      fotoFinal = `${apiUrl.origin}${fotoUrl.pathname}`;
    } catch {
      // Si falla, se deja la URL original
    }
  }

  const esValidado = !payload;

  return (
    <div className="carnet-card-wrap" draggable="false">
      <div className="carnet carnet-card">

        <div className="carnet-header">
          <span className="carnet-logo">Identera</span>
          <span className="carnet-badge">{esValidado ? 'Validado' : 'Itera'}</span>
        </div>

        <div className="carnet-body">

          {/* FOTO Y NOMBRE */}
          <div className="carnet-profile">
            {fotoFinal ? (
              <img src={fotoFinal} alt="Foto" className="carnet-foto" draggable="false" />
            ) : (
              <div className="carnet-foto-placeholder" />
            )}
            <div className="carnet-user-info">
              <h2 className="carnet-nombre">{nombre}</h2>
              <p className="carnet-cargo">{cargo}</p>
            </div>
          </div>

          {/* DETALLES Y QR */}
          <div className="carnet-details-row">
            <div className="carnet-meta">
              <div className="carnet-field">
                <span className="carnet-label">Cédula</span>
                <span className="carnet-value">{cedula}</span>
              </div>
              <div className="carnet-field">
                <span className="carnet-label">ARL</span>
                <span className="carnet-value">{arl}</span>
              </div>
              <div className="carnet-field">
                <span className="carnet-label">ID</span>
                <span className="carnet-value mono">#{codigoValidador}</span>
              </div>
            </div>

            <div className="carnet-qr-box">
              {payload ? (
                <QRCodeSVG
                  value={payload}
                  size={88}
                  level="M"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#0a0a0a"
                  style={{ borderRadius: '4px' }}
                />
              ) : (
                <div className="carnet-validado-icon" title="Carnet validado">✓</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
