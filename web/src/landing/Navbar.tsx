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
            <span className="logo-text">SECURECHAT</span>
          </div>
        </div>
        
        <div className="navbar-center">
          <button className="nav-link" onClick={() => scrollToSection('hero')}>
            <span className="nav-num">01</span> Wearable
          </button>
          <button className="nav-link" onClick={() => scrollToSection('product')}>
            <span className="nav-num">02</span> Neural
          </button>
          <button className="nav-link" onClick={() => scrollToSection('security')}>
            <span className="nav-num">03</span> Programs
          </button>
          <button className="nav-link" onClick={() => scrollToSection('architecture')}>
            <span className="nav-num">04</span> Updates
          </button>
          <button className="nav-link" onClick={() => {}}>
            <span className="nav-num">05</span> Search
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
