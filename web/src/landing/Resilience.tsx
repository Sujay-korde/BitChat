import { useEffect, useRef, useState } from 'react';
import './Resilience.css';

export function Resilience() {
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
    <section className="resilience-section" ref={containerRef}>
      <div className="res-container">
        <h2 className={`section-heading ${isVisible ? 'fade-in' : ''}`}>
          BUILT FOR IMPERFECT<br />NETWORKS.
        </h2>
        
        <div className={`timeline-viz ${isVisible ? 'fade-in delay-1' : ''}`}>
          
          <div className="timeline-event secure">
            <div className="t-dot"></div>
            <div className="t-label">CONNECTED</div>
            <div className="t-anno">PRESENCE</div>
          </div>
          
          <div className="timeline-line"></div>
          
          <div className="timeline-event info">
            <div className="t-dot"></div>
            <div className="t-label">HEARTBEAT</div>
            <div className="t-anno">HEARTBEAT</div>
          </div>
          
          <div className="timeline-line dashed"></div>
          
          <div className="timeline-event danger">
            <div className="t-dot"></div>
            <div className="t-label">NETWORK LOST</div>
          </div>
          
          <div className="timeline-line empty"></div>
          
          <div className="timeline-event warning">
            <div className="t-dot"></div>
            <div className="t-label">RECONNECTING</div>
            <div className="t-anno">BACKOFF (1s, 2s, 4s...)</div>
          </div>
          
          <div className="timeline-line"></div>
          
          <div className="timeline-event secure">
            <div className="t-dot"></div>
            <div className="t-label">RESTORED</div>
            <div className="t-anno">STATE RESTORATION</div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
