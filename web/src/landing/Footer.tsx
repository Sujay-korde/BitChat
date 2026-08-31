import { useNavigate } from 'react-router-dom';
import { Shield, ExternalLink, ArrowUpRight, Lock, CheckCircle2 } from 'lucide-react';
import './Footer.css';

export function Footer() {
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="footer-4col">
      <div className="footer-container">
        {/* Main 4-Column Grid */}
        <div className="footer-grid">
          {/* Column 1: Brand & Image */}
          <div className="footer-col brand-col">
            <div className="footer-brand">
              <div className="footer-brand-header">
                <img 
                  src="/securechat_footer_brand.png" 
                  alt="SecureChat Protocol" 
                  className="footer-brand-img" 
                />
                <span className="footer-brand-name">SECURECHAT</span>
              </div>
              <p className="footer-brand-desc">
                High-assurance zero-knowledge messaging protocol built with client-side X25519 ECC and AES-256-GCM AEAD encryption.
              </p>
              <div className="footer-status-badge">
                <span className="status-dot"></span>
                <span>AEAD Protocol Verified</span>
              </div>
            </div>
          </div>

          {/* Column 2: Platform & Features */}
          <div className="footer-col">
            <h4 className="footer-col-title">Navigation</h4>
            <ul className="footer-links">
              <li><button onClick={() => scrollToSection('hero')}>01 / Home</button></li>
              <li><button onClick={() => scrollToSection('architecture')}>02 / Architecture</button></li>
              <li><button onClick={() => scrollToSection('features')}>03 / Features Grid</button></li>
              <li><button onClick={() => navigate('/architecture')}>04 / Flowchart Spec</button></li>
              <li><button onClick={() => scrollToSection('security')}>05 / Security Model</button></li>
            </ul>
          </div>

          {/* Column 3: Cryptographic Guarantees */}
          <div className="footer-col">
            <h4 className="footer-col-title">Protocol Invariants</h4>
            <ul className="footer-links">
              <li>
                <span className="footer-spec-item">
                  <Lock size={12} className="spec-icon" />
                  X25519 Key Isolation
                </span>
              </li>
              <li>
                <span className="footer-spec-item">
                  <Shield size={12} className="spec-icon" />
                  AES-256-GCM AEAD
                </span>
              </li>
              <li>
                <span className="footer-spec-item">
                  <CheckCircle2 size={12} className="spec-icon" />
                  Anti-Replay AAD Monotonic
                </span>
              </li>
              <li>
                <span className="footer-spec-item">
                  <ExternalLink size={12} className="spec-icon" />
                  Dual WS / TCP Transport
                </span>
              </li>
            </ul>
          </div>

          {/* Column 4: Action & Legal */}
          <div className="footer-col cta-col">
            <h4 className="footer-col-title">Access Application</h4>
            <p className="footer-col-desc">
              Launch the zero-knowledge client interface directly in your browser.
            </p>
            <button className="footer-app-cta" onClick={() => navigate('/app')}>
              <span>LAUNCH APP</span>
              <ArrowUpRight size={16} />
            </button>
            <div className="footer-social-row">
              <a 
                href="https://github.com/Sujay-korde/BitChat" 
                target="_blank" 
                rel="noreferrer" 
                className="footer-social-link"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
                <span>GitHub Source</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer Bottom Strip */}
        <div className="footer-bottom-bar">
          <div className="footer-copyright">
            © 2026 SECURECHAT PROTOCOL • ZERO-KNOWLEDGE E2EE
          </div>
          <div className="footer-meta-tag">
            VERIFIED SYMMETRIC CIPHERTEXT ONLY
          </div>
        </div>
      </div>
    </footer>
  );
}

