import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Navbar.css';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        <div className="navbar-left">
          <div className="navbar-logo">
            <div className="logo-mark"></div>
            <span>SECURECHAT</span>
          </div>
        </div>
        
        <div className="navbar-center">
          <button className="nav-link active" onClick={() => scrollToSection('hero')}>Home</button>
          <button className="nav-link" onClick={() => scrollToSection('product')}>Product</button>
          <button className="nav-link" onClick={() => scrollToSection('security')}>Security</button>
          <button className="nav-link" onClick={() => scrollToSection('architecture')}>Architecture</button>
        </div>
        
        <div className="navbar-right">
          <button className="primary-cta-dark" onClick={() => navigate('/app')}>
            OPEN SECURECHAT
          </button>
        </div>
      </div>
    </nav>
  );
}
