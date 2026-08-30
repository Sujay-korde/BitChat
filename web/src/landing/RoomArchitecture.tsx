import { useEffect, useRef, useState } from 'react';
import './RoomArchitecture.css';

export function RoomArchitecture() {
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
    <section className="room-section" ref={containerRef}>
      <div className="room-container">
        <h2 className={`section-heading ${isVisible ? 'fade-in' : ''}`}>
          PRIVATE COMMUNICATION<br />
          DOESN'T STOP AT TWO PEOPLE.
        </h2>
        
        <div className={`room-viz ${isVisible ? 'fade-in delay-1' : ''}`}>
          <div className="peers">
            <div className="peer">ALICE</div>
            <div className="peer">BOB</div>
            <div className="peer">CHARLIE</div>
            <div className="peer">DAN</div>
          </div>
          
          <div className="down-arrow">↓</div>
          
          <div className="room-node">
            <span className="room-title">SECURE ROOM</span>
            <div className="room-epoch">EPOCH 04</div>
          </div>
          
          <div className="down-arrow">↓</div>
          
          <div className="encrypted-msg-node">
            <span className="enc-label">ENCRYPTED MESSAGE</span>
          </div>
          
          <div className="room-features">
            <div className="r-feature">
              <span className="r-check">✓</span> ROOM KEY
            </div>
            <div className="r-feature">
              <span className="r-check">✓</span> PAIRWISE DISTRIBUTION
            </div>
            <div className="r-feature">
              <span className="r-check">✓</span> EPOCH ISOLATION
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
