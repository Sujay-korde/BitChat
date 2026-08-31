import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './StorySection.css';
import { useState, useEffect } from 'react';

export function StorySection() {
  const navigate = useNavigate();
  // stage: 0: initial, 1: rahul encrypted, 2: relay active, 3: relay cleared, 4: pritam authenticating, 5: pritam decrypted
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let timeouts: ReturnType<typeof setTimeout>[] = [];

    const runCycle = () => {
      setStage(0);

      timeouts.push(setTimeout(() => setStage(1), 750));
      timeouts.push(setTimeout(() => setStage(2), 2200));
      timeouts.push(setTimeout(() => setStage(3), 2900));
      timeouts.push(setTimeout(() => setStage(4), 4100));
      timeouts.push(setTimeout(() => setStage(5), 4400));
    };

    runCycle();
    const interval = setInterval(runCycle, 5000);

    return () => {
      clearInterval(interval);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const msg = 'Hey Pritam, are you free?';
  const cipher = '7F0A 89C1 E43D';

  return (
    <section className="story-section" id="architecture">
      <div className="story-container">
        {/* Left Column: Security Protocol Bento Animation */}
        <div className="story-mockup">
          <div className="proto-bento">
            <div className="proto-stage">
              <div className="proto-wire"></div>

              {/* Moving Ciphertext Packet */}
              <div className="proto-packet">
                <div className="proto-packet-box">░ 7F0A 89C1 ░</div>
              </div>

              <div className="proto-grid-nodes">
                {/* Node 1: Rahul (Sender) */}
                <div className="proto-node active">
                  <div>
                    <div className="proto-node-top">
                      <span className="proto-node-label">Rahul</span>
                      <div className="proto-node-meta-list">
                        <span>• Origin Node</span>
                        <span>• Key: #48E1-X255</span>
                      </div>
                    </div>
                    <div className="proto-bubble">
                      {stage < 1 ? (
                        <span>{msg}</span>
                      ) : (
                        <span className="proto-mono-text proto-encrypted-hash">{cipher}</span>
                      )}
                    </div>
                  </div>
                  <div className="proto-node-foot">
                    <span>{stage < 1 ? 'PLAINTEXT' : 'CIPHERTEXT'}</span>
                    <span className="proto-state-badge verified">
                      {stage < 1 ? '✓ LOCAL' : '✓ ENCRYPTED'}
                    </span>
                  </div>
                </div>

                {/* Node 2: Relay (Untrusted Transit) */}
                <div className="proto-node" style={{ borderStyle: 'dashed' }}>
                  <div>
                    <div className="proto-node-top">
                      <span className="proto-node-label" style={{ color: '#707684' }}>Relay</span>
                      <div className="proto-node-meta-list">
                        <span>• Blind Router</span>
                        <span>• Zero-Knowledge</span>
                      </div>
                    </div>
                    <div className="proto-bubble relay">
                      {stage === 2 ? (
                        <span className="proto-mono-text proto-encrypted-hash">░ {cipher} ░</span>
                      ) : (
                        <span className="proto-mono-text proto-ciphertext">░░░░░░░░░░░░</span>
                      )}
                    </div>
                  </div>
                  <div className="proto-node-foot">
                    <span>CIPHERTEXT ONLY</span>
                    <span className="proto-state-badge">NO KEY</span>
                  </div>
                </div>

                {/* Node 3: Pritam (Receiver) */}
                <div className="proto-node active">
                  <div>
                    <div className="proto-node-top">
                      <span className="proto-node-label">Pritam</span>
                      <div className="proto-node-meta-list">
                        <span>• Target Node</span>
                        <span>• Key: #90B4-X255</span>
                      </div>
                    </div>
                    <div className="proto-bubble">
                      {stage < 4 && (
                        <span className="proto-mono-text proto-ciphertext">░░░░░░░░░░░░</span>
                      )}
                      {stage === 4 && (
                        <span className="proto-mono-text proto-encrypted-hash">{cipher}</span>
                      )}
                      {stage >= 5 && (
                        <span>{msg}</span>
                      )}
                    </div>
                  </div>
                  <div className="proto-node-foot">
                    <span>
                      {stage < 4 ? 'STANDBY' : stage === 4 ? 'AUTHENTICATING' : 'PLAINTEXT'}
                    </span>
                    <span
                      className={`proto-state-badge ${stage >= 4 ? 'verified' : ''}`}
                    >
                      {stage < 4 ? 'IDLE' : stage === 4 ? 'TAG MATCH' : '✓ DECRYPTED'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Text & CTA */}
        <div className="story-content">
          <div className="story-badge">1 Architecture</div>
          <h2 className="story-heading">Private By Default</h2>
          <p className="story-description">
            SecureChat enforces true end-to-end encryption. Your messages are encrypted on your device and can only be decrypted by the recipient. The server acts as a blind relay, incapable of reading your data.
          </p>
          <motion.button 
            className="story-cta"
            whileHover="hover"
            initial="rest"
            onClick={() => navigate('/architecture')}
          >
            <span>Complete Flow</span>
            <motion.div 
              className="cta-arrow"
              variants={{
                rest: { x: 0 },
                hover: { x: 4 }
              }}
            >
              <ArrowRight size={18} />
            </motion.div>
          </motion.button>
        </div>
      </div>
    </section>
  );
}

