import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Navbar.css';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleLogoClick = () => {
    if (location.pathname !== '/') {
      navigate('/');
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        <div className="navbar-left">
          <div className="navbar-logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
            <span className="logo-text">SECURECHAT</span>
          </div>
        </div>
        
        <div className="navbar-center">
          <button className="nav-link" onClick={() => scrollToSection('hero')}>
            <span className="nav-num">01</span> Overview
          </button>
          <button className="nav-link" onClick={() => scrollToSection('architecture')}>
            <span className="nav-num">02</span> Architecture
          </button>
          <button className="nav-link" onClick={() => scrollToSection('features')}>
            <span className="nav-num">03</span> Features
          </button>
          <button className="nav-link" onClick={() => navigate('/architecture')}>
            <span className="nav-num">04</span> Flowchart
          </button>
          <button className="nav-link" onClick={() => scrollToSection('security')}>
            <span className="nav-num">05</span> Security
          </button>
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

