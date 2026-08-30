import { useNavigate } from 'react-router-dom';
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
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-top">
          <div className="footer-left">
            SECURECHAT
          </div>
          
          <div className="footer-center">
            <button onClick={() => scrollToSection('product')}>PRODUCT</button>
            <button onClick={() => scrollToSection('security')}>SECURITY</button>
            <button onClick={() => scrollToSection('architecture')}>ARCHITECTURE</button>
          </div>
          
          <div className="footer-right">
            <button onClick={() => navigate('/app')}>OPEN APP ↗</button>
          </div>
        </div>
        
        <div className="footer-bottom">
          &copy; 2026 SecureChat
        </div>
      </div>
    </footer>
  );
}
