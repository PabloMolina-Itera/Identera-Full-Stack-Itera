import { Link, Navigate } from 'react-router-dom';
import { authService } from '../services/authService';
import './Landing.css';

export default function Landing() {
  const user = authService.getCurrentUser();

  if (user) {
    if (user.role === 'USUARIO') {
      return <Navigate to="/crear" replace />;
    }

    if (user.role === 'SEGURIDAD') {
      return (
        <div className="landing page-wrap landing-premium">
          <div className="blob blob-sec-1"></div>
          <div className="blob blob-sec-2"></div>
          <div className="welcome-container glass animate-container premium-card">
            <div className="welcome-badge badge-sec animate-item-1">
              <span>🛡️ Seguridad y Control</span>
            </div>

            <div className="welcome-header animate-item-2">
              <div className="welcome-avatar-wrap">
                <div className="float-anim" style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', width: '100px', height: '100px', filter: 'drop-shadow(0 0 10px rgba(91,108,249,0.3))' }}>
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <path d="M5 9V6C5 5.44772 5.44772 5 6 5H9" stroke="#5b6cf9" strokeWidth="2.5" strokeLinecap="square" />
                    <path d="M19 9V6C19 5.44772 18.5523 5 18 5H15" stroke="#5b6cf9" strokeWidth="2.5" strokeLinecap="square" />
                    <path d="M19 15V18C19 18.5523 18.5523 19 18 19H15" stroke="#5b6cf9" strokeWidth="2.5" strokeLinecap="square" />
                    <path d="M5 15V18C5 18.5523 5.44772 19 6 19H9" stroke="#5b6cf9" strokeWidth="2.5" strokeLinecap="square" />
                    <rect x="8" y="8" width="3" height="3" fill="var(--primary)" />
                    <rect x="13" y="8" width="3" height="3" fill="var(--primary)" />
                    <rect x="8" y="13" width="3" height="3" fill="var(--primary)" />
                    <path d="M13 13H15V14H13V13Z" fill="var(--primary)" />
                    <path d="M15 14H16V16H15V14Z" fill="var(--primary)" />
                    <path d="M13 15H14V16H13V15Z" fill="var(--primary)" />
                  </svg>
                </div>
              </div>
              <h1 className="welcome-title">Panel de Seguridad</h1>
            </div>

            <div className="welcome-body animate-item-3">
              <p>Verifica los accesos rápidos o inicia el escaneo para validar las identidades de los iterantes.</p>
              <div className="welcome-actions">
                <Link to="/validar" className="btn-huge primary-gradient pulse-anim">Iniciar Validación 📷</Link>
                <Link to="/escaneo-masa" className="btn-huge secondary-gradient">Escaneo Masivo 📷</Link>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (user.role === 'ADMINISTRADOR') {
      return (
        <div className="landing page-wrap landing-premium" style={{ perspective: '1000px' }}>
          <div className="blob blob-adm-1" style={{ opacity: 0.15 }}></div>
          <div className="blob blob-adm-2" style={{ opacity: 0.15 }}></div>

          <div className="animate-container admin-minimal-card">
            <div className="welcome-header animate-item-2" style={{ marginBottom: '3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem' }}>
                <div className="float-anim admin-minimal-avatar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#5b6cf9" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: '45%', height: '45%' }}>
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
              </div>

              <h1 className="admin-minimal-title">
                Centro de Mando
              </h1>

              <p style={{
                fontSize: '0.85rem', color: '#5b6cf9', fontWeight: 600,
                letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0
              }}>
                Administrador • {user.name}
              </p>
            </div>

            <div className="welcome-body animate-item-3" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', alignItems: 'center' }}>
              <p className="admin-minimal-desc">
                Plataforma de control centralizado. Visualiza acreditaciones, administra rangos y audita la seguridad en tiempo real.
              </p>

              <Link to="/admin" className="admin-minimal-btn pulse-anim">
                Gestión de Iterantes <span style={{ opacity: 0.4, transition: 'transform 0.4s', fontSize: '1.2rem' }}>&rarr;</span>
              </Link>

              <div className="admin-minimal-feature">
                <div style={{
                  padding: '0.8rem', background: 'rgba(91,108,249,0.08)',
                  border: '1px solid rgba(91,108,249,0.15)', borderRadius: '12px',
                  color: '#5b6cf9', flexShrink: 0
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <h3 className="admin-minimal-feature-title">Arquitectura Identera</h3>
                  <p className="admin-minimal-feature-desc">
                    Red de accesos protegida computacionalmente. Cualquier modificación de control se despliega en milisegundos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  // Vista Pública (no autenticado)
  return (
    <div className="landing-public">
      <div className="public-blob-bg">
        <div className="pb-1"></div>
        <div className="pb-2"></div>
      </div>

      <section className="public-hero-section">
        <h1 className="public-hero-title">
          Control de Acceso <br />
          <span style={{ 
            fontSize: '1.3em', 
            display: 'block', 
            marginTop: '0.2rem',
            filter: 'drop-shadow(0 4px 15px rgba(96, 165, 250, 0.3))',
            backgroundImage: 'linear-gradient(135deg, #60a5fa 0%, #818cf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Iterantes</span>
        </h1>
        <p className="public-hero-desc" style={{ marginBottom: '1.5rem' }}>
          Crea, valida y controla accesos a los interantes con una solución rápida y segura.
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '2.5rem',
          animation: 'fade-up 0.7s ease-out'
        }}>
          <a
            href="https://iteraprocess.com/?gad_source=1&gad_campaignid=23593203727&gbraid=0AAAAAD-yMW5Wnq_81YUMML6tZDyenMXXq&gclid=Cj0KCQjwm6POBhCrARIsAIG58CIgi8uyj9Om4vPT6vTU0mjzT021fIbFYGwMIZgF7dH93C7lzgpyaHcaApcYEALw_wcB"
            target="_blank" 
            rel="noopener noreferrer"
            className="public-promo-link"
            style={{
              background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
              borderRadius: '50px',
              padding: '0.6rem 1.5rem',
              fontSize: '0.95rem',
              color: 'var(--muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              boxShadow: '0 4px 20px color-mix(in srgb, var(--accent) 5%, transparent)',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>🚀</span>
            <span>
              Conoce <strong style={{ color: '#818cf8', fontWeight: 600 }}>Itera Process</strong> y su experiencia en transformación digital y soluciones en la nube.
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '0.2rem', opacity: 0.7 }}><path d="M7 17l9.2-9.2M17 17V7H7" /></svg>
          </a>
        </div>
        <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginTop: '1rem' }}>
          <Link to="/validar" className="public-login-btn" style={{ margin: 0 }}>
            Validación &rarr;
          </Link>
        </div>
      </section>

      <section className="public-single-feature" style={{ maxWidth: '800px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <div className="public-feature-card" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '3rem 2rem',
          gap: '1.5rem'
        }}>
          <div className="feature-icon-wrapper" style={{
            margin: '0 auto',
            width: '90px',
            height: '90px',
            fontSize: '3rem'
          }}>
            📷
          </div>
          <div>
            <h3 className="feature-card-title" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
              Validación en tiempo real
            </h3>
            <p className="feature-card-desc" style={{ fontSize: '1.15rem', maxWidth: '100%', lineHeight: '1.6', margin: '0 auto' }}>
              Verifica cada código al instante, detecta usos inválidos y mantén todos tus accesos sincronizados sin esfuerzo.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
