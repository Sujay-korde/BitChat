import { useEffect, useRef, useState } from 'react';
import './EncryptionStory.css';

export function EncryptionStory() {
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
    <section className="story-section" id="product" ref={containerRef}>
      <div className="story-container">
        <h2 className={`section-heading ${isVisible ? 'fade-in' : ''}`}>
          THE SERVER DOESN'T<br />NEED TO KNOW.
        </h2>
        <p className={`section-supporting ${isVisible ? 'fade-in delay-1' : ''}`}>
          Your message is transformed before it leaves your device.
        </p>

        <div className={`pipeline-viz ${isVisible ? 'fade-in delay-2' : ''}`}>
          <div className="pipeline-node actor">
            <span>ALICE</span>
          </div>
          
          <div className="pipeline-arrow">↓</div>
          
          <div className="pipeline-node data plaintext">
            <span>"HELLO BOB"</span>
            <div className="packet-anim"></div>
          </div>
          
          <div className="pipeline-arrow">↓</div>
          
          <div className="pipeline-node crypto">
            <span>AES-256-GCM</span>
          </div>
          
          <div className="pipeline-arrow">↓</div>
          
          <div className="pipeline-node data ciphertext">
            <span>0x8F4C2A9B...</span>
            <div className="packet-anim cipher"></div>
          </div>
          
          <div className="pipeline-arrow">↓</div>
          
          <div className="pipeline-node server">
            <div className="server-label">SECURECHAT RELAY</div>
            <div className="server-states">
              <span className="state-badge">ROUTE ONLY</span>
              <span className="state-badge secure">NO PLAINTEXT</span>
            </div>
          </div>
          
          <div className="pipeline-arrow">↓</div>
          
          <div className="pipeline-node data ciphertext">
            <span>0x8F4C2A9B...</span>
            <div className="packet-anim cipher"></div>
          </div>

          <div className="pipeline-arrow">↓</div>
          
          <div className="pipeline-node actor">
            <span>BOB</span>
          </div>
          
          <div className="pipeline-arrow">↓</div>
          
          <div className="pipeline-node data plaintext">
            <span>"HELLO BOB"</span>
          </div>
        </div>
      </div>
    </section>
  );
}
