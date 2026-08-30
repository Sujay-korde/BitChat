import { useEffect, useRef, useState } from 'react';
import './SecuritySummary.css';

const CHECKLIST = [
  "Client-side message encryption",
  "Ciphertext-only relay",
  "Authenticated peer identity",
  "Routing metadata integrity",
  "Replay protection",
  "Room epoch isolation",
  "Secure reconnection",
  "TCP / WebSocket protocol parity"
];

export function SecuritySummary() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  return (
    <section className="summary-section" ref={containerRef}>
      <div className="summary-container">
        <h2 className={`section-heading ${isVisible ? 'fade-in' : ''}`}>
          WHAT SECURECHAT PROTECTS.
        </h2>
        
        <div className={`summary-content ${isVisible ? 'fade-in delay-1' : ''}`}>
          <ul className="security-checklist">
            {CHECKLIST.map((item, index) => (
              <li key={index} className="checklist-item">
                <span className="check-icon">✓</span>
                <span className="check-text">{item}</span>
              </li>
            ))}
          </ul>
          
          <div className="security-honesty">
            SecureChat is designed so the relay does not need access to message plaintext. Cryptographic keys remain within the client session.
          </div>
        </div>
      </div>
    </section>
  );
}
