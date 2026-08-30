import { useNavigate } from 'react-router-dom';
import './FinalCTA.css';

export function FinalCTA() {
  const navigate = useNavigate();

  return (
    <section className="final-cta-section">
      <div className="cta-container">
        <h2 className="cta-heading">
          YOUR MESSAGES.<br />
          YOUR KEYS.<br />
          YOUR SESSION.
        </h2>
        
        <p className="cta-supporting">
          Start a private conversation with SecureChat.
        </p>
        
        <button className="cta-primary-large" onClick={() => navigate('/app')}>
          OPEN SECURECHAT <span className="arrow">↗</span>
        </button>
        
        <div className="cta-metadata">
          X25519 &nbsp;&middot;&nbsp; ED25519 &nbsp;&middot;&nbsp; AES-256-GCM
        </div>
      </div>
    </section>
  );
}
