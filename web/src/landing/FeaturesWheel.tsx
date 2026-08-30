import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ShieldAlert, KeyRound, Ghost, ServerCrash, Flame } from 'lucide-react';
import './FeaturesWheel.css';

const features = [
  {
    id: 'e2ee',
    title: 'Frictionless E2EE',
    desc: 'Complex key management is handled transparently. Users never see public keys, fingerprints, or manual verification flows unless they opt-in.',
    icon: <Lock size={32} />
  },
  {
    id: 'predictive',
    title: 'Predictive Security',
    desc: 'Strict AAD validation and monotonic counters inherently reject replayed or out-of-order packets before decryption is even attempted.',
    icon: <ShieldAlert size={32} />
  },
  {
    id: 'forward',
    title: 'Forward Secrecy',
    desc: 'Every message ratchets the encryption key forward. A compromised key today cannot be used to decrypt messages sent yesterday.',
    icon: <KeyRound size={32} />
  },
  {
    id: 'deniability',
    title: 'Deniability',
    desc: 'While the authorship of a message is authenticated, the cryptographic protocol ensures plausible deniability to any third party.',
    icon: <Ghost size={32} />
  },
  {
    id: 'ignorance',
    title: 'Server Ignorance',
    desc: 'The routing relay only observes opaque byte streams. It has no knowledge of room participants, message sizes, or contents.',
    icon: <ServerCrash size={32} />
  },
  {
    id: 'ephemeral',
    title: 'Ephemeral Rooms',
    desc: 'Room state is maintained strictly in-memory. Once the last participant disconnects, all routing metadata is permanently purged.',
    icon: <Flame size={32} />
  }
];

export function FeaturesWheel() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section className="features-wheel-section">
      <div className="wheel-container">
        
        {/* Left: Tab Wheel */}
        <div className="wheel-tabs">
          <div className="wheel-tabs-inner">
            {features.map((feat, i) => {
              const isActive = i === activeIndex;
              return (
                <button 
                  key={feat.id}
                  className={`wheel-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveIndex(i)}
                >
                  <span className="tab-number">0{i + 1}</span>
                  <span className="tab-title">{feat.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Card Stack */}
        <div className="wheel-cards">
          <AnimatePresence mode="popLayout">
            {features.map((feat, i) => {
              if (i !== activeIndex) return null;
              
              return (
                <motion.div
                  key={feat.id}
                  className="wheel-card active-card"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20, filter: 'blur(10px)' }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <div className="card-icon">
                    {feat.icon}
                  </div>
                  <h3 className="card-title">{feat.title}</h3>
                  <p className="card-desc">{feat.desc}</p>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {/* Static background cards to simulate the stack depth */}
          <div className="wheel-card bg-card-1"></div>
          <div className="wheel-card bg-card-2"></div>
        </div>
        
      </div>
    </section>
  );
}
