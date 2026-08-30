import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Hero.css';

export function Hero() {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Trigger entrance animation shortly after mount
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const scrollToArchitecture = () => {
    const el = document.getElementById('architecture');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="hero">
      {/* Video Background */}
      <video 
        className="hero-video-bg" 
        src="/hero.mp4" 
        autoPlay 
        muted 
        loop 
        playsInline
      ></video>
      <div className="hero-gradient-overlay"></div>
      
      <div className={`hero-content-container ${loaded ? 'animate-in' : ''}`}>
        <div className="hero-content">
          <h1 className="hero-heading anim-2">
            PRIVATE COMMUNICATION <br />
            <span className="mono-highlight">[ ZERO-TRUST RELAY ]</span>
          </h1>
          
          <p className="hero-supporting anim-3">
            SecureChat encrypts messages on your device before they reach the network, while the server operates <span className="mono-highlight-inline">strictly as an untrusted relay</span>.
          </p>
          
          <div className="hero-actions anim-4">
            <button className="cta-primary-dark" onClick={() => navigate('/app')}>
              OPEN SECURECHAT
            </button>
          </div>
        </div>

        {/* Technical Overlay Panel at the bottom corners */}
        <div className="hero-bottom-bar anim-5">
          <div className="bottom-left">
            The journey begins in stillness.
          </div>
          <div className="bottom-center">
            A tranquil space for personal growth, dreamwork,<br />
            and guided reflection. No noise. Just becoming.
          </div>
          <div className="bottom-right" onClick={scrollToArchitecture} style={{cursor: 'pointer'}}>
            [Scroll to Explore]
          </div>
        </div>
      </div>
    </section>
  );
}
