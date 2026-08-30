import { useEffect, useRef, useState } from 'react';
import './TransportArchitecture.css';

export function TransportArchitecture() {
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
    <section className="transport-section" id="architecture" ref={containerRef}>
      <div className="transport-container">
        <h2 className={`section-heading ${isVisible ? 'fade-in' : ''}`}>
          ONE PROTOCOL.<br />
          TWO TRANSPORTS.
        </h2>
        
        <div className={`transport-diagram ${isVisible ? 'fade-in delay-1' : ''}`}>
          <div className="diagram-top">
            <div className="protocol-node">SECURECHAT PROTOCOL</div>
          </div>
          
          <div className="diagram-lines">
            <div className="line-vertical main-stem"></div>
            <div className="line-horizontal"></div>
            <div className="line-vertical branch-left"></div>
            <div className="line-vertical branch-right"></div>
          </div>
          
          <div className="diagram-middle">
            <div className="transport-node">
              <span className="t-name">WEBSOCKET</span>
              <span className="t-env">BROWSER</span>
            </div>
            
            <div className="transport-node">
              <span className="t-name">TCP</span>
              <span className="t-env">PYTHON</span>
            </div>
          </div>
          
          <div className="diagram-lines bottom">
            <div className="line-vertical branch-left-bottom"></div>
            <div className="line-vertical branch-right-bottom"></div>
            <div className="line-horizontal bottom-h"></div>
            <div className="line-vertical main-stem-bottom"></div>
          </div>
          
          <div className="diagram-bottom">
            <div className="router-node">SECURECHAT ROUTER</div>
          </div>
          
          {/* Annotations */}
          <div className="trans-anno ta-1">HEARTBEAT</div>
          <div className="trans-anno ta-2">RECONNECT</div>
          <div className="trans-anno ta-3">ACK</div>
          <div className="trans-anno ta-4">PRESENCE</div>
          <div className="trans-anno ta-5">MESSAGE ROUTING</div>
        </div>
        
        <p className="transport-caption">
          Different transports. Same protocol. Same cryptographic boundary.
        </p>
      </div>
    </section>
  );
}
