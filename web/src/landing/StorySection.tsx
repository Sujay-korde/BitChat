import { motion } from 'framer-motion';
import { ArrowRight, Lock, Shield, Server } from 'lucide-react';
import './StorySection.css';
import { useState, useEffect } from 'react';

export function StorySection() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => (s + 1) % 4);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="story-section" id="architecture">
      <div className="story-container">
        {/* Left Column: Interactive Mock Dashboard */}
        <div className="story-mockup">
          <div className="mockup-header">
            <div className="window-controls">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <div className="window-title">SecureChat Protocol</div>
          </div>
          
          <div className="mockup-body">
            <div className="flow-visualizer">
              <div className={`node client ${step === 0 ? 'active' : ''}`}>
                <Shield size={24} />
                <span>Alice</span>
              </div>
              
              <div className="flow-path">
                <motion.div 
                  className="packet"
                  initial={{ left: "0%" }}
                  animate={{ left: step >= 1 ? "100%" : "0%" }}
                  transition={{ duration: 0.8 }}
                >
                  <Lock size={14} color="#000" />
                </motion.div>
              </div>

              <div className={`node server ${step === 1 || step === 2 ? 'active' : ''}`}>
                <Server size={24} />
                <span>Relay</span>
              </div>

              <div className="flow-path">
                <motion.div 
                  className="packet"
                  initial={{ left: "0%" }}
                  animate={{ left: step >= 3 ? "100%" : "0%" }}
                  transition={{ duration: 0.8 }}
                >
                  <Lock size={14} color="#000" />
                </motion.div>
              </div>

              <div className={`node client ${step === 3 ? 'active' : ''}`}>
                <Shield size={24} />
                <span>Bob</span>
              </div>
            </div>

            <div className="terminal-logs">
              {step >= 0 && <div>[00:00:01] Alice: Encrypting message with Bob's public key...</div>}
              {step >= 1 && <div>[00:00:02] Relay: Received encrypted payload. Cannot decrypt.</div>}
              {step >= 2 && <div>[00:00:03] Relay: Forwarding ciphertext to Bob...</div>}
              {step >= 3 && <div>[00:00:04] Bob: Decrypting message successfully.</div>}
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
          >
            <span>Read the Whitepaper</span>
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
