import { useEffect, useRef, useState } from 'react';
import './ProductShowcase.css';

export function ProductShowcase() {
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
      { threshold: 0.2 }
    );
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  return (
    <section className="showcase-section" id="product" ref={containerRef}>
      <div className="showcase-container">
        <h2 className={`section-heading ${isVisible ? 'fade-in' : ''}`}>
          A PRIVATE CONVERSATION,<br />
          DESIGNED LIKE AN INSTRUMENT.
        </h2>
        
        <div className={`mock-app-window ${isVisible ? 'fade-in delay-1' : ''}`}>
          
          <div className="mock-sidebar">
            <div className="mock-nav">
              <span className="mock-brand">SECURECHAT</span>
            </div>
            <div className="mock-dms">
              <div className="mock-dm-item active">
                <div className="mock-avatar">B</div>
                <span>bob</span>
              </div>
              <div className="mock-dm-item">
                <div className="mock-avatar">C</div>
                <span>charlie</span>
              </div>
            </div>
          </div>
          
          <div className="mock-main">
            <div className="mock-header">
              <div className="mock-header-info">
                <span className="mock-target">bob</span>
                <span className="mock-status secure">● SECURE E2E</span>
              </div>
            </div>
            <div className="mock-chat-area">
              <div className="mock-msg incoming">
                <div className="mock-msg-bubble">Hey Alice, is the design finalized?</div>
              </div>
              <div className="mock-msg outgoing">
                <div className="mock-msg-bubble">Yes, the new architecture looks solid.</div>
                <div className="mock-msg-status">SENT ✓</div>
              </div>
            </div>
            <div className="mock-input-area">
              <div className="mock-input">Type a message...</div>
            </div>
          </div>
          
          <div className="mock-inspector">
            <div className="inspector-header">SECURITY INSPECTOR</div>
            
            <div className="inspector-panel">
              <div className="inspector-row">
                <span>IDENTITY</span>
                <span className="secure">VERIFIED</span>
              </div>
              <div className="inspector-row">
                <span>ENCRYPTION</span>
                <span>AES-GCM</span>
              </div>
              <div className="inspector-row">
                <span>EPOCH</span>
                <span>04</span>
              </div>
            </div>
            
          </div>
          
          {/* Annotations */}
          <div className="annotation a-1">CLIENT ENCRYPTION</div>
          <div className="annotation a-2">IDENTITY VERIFIED</div>
          <div className="annotation a-3">MESSAGE AUTHENTICATED</div>
          <div className="annotation a-4">DELIVERY ACK</div>
          
        </div>
      </div>
    </section>
  );
}
