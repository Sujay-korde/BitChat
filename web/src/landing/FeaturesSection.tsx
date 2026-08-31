import { motion } from 'framer-motion';
import { ShieldCheck, Lock, RefreshCw, Layers, Cpu, Radio } from 'lucide-react';
import './FeaturesSection.css';

const featureList = [
  {
    icon: <Lock size={22} />,
    title: 'Zero-Knowledge Blind Relay',
    description: 'The routing server acts strictly as an untrusted blind packet forwarder. It processes opaque ciphertext blobs without possessing key material.',
    tag: 'NO PLAINTEXT ACCESS',
    spec: 'Zero-Knowledge'
  },
  {
    icon: <ShieldCheck size={22} />,
    title: 'AEAD Integrity Guard',
    description: 'Every transmitted frame is sealed using AES-256-GCM with Additional Authenticated Data (AAD) to instantly detect bit flips or payload tampering.',
    tag: 'TAG MATCH VERIFIED',
    spec: 'AES-256-GCM'
  },
  {
    icon: <RefreshCw size={22} />,
    title: 'Double Ratchet Keying',
    description: 'Provides Perfect Forward Secrecy and Post-Compromise Security by rotating symmetric session keys after every exchange.',
    tag: 'X25519 ROTATION',
    spec: 'Forward Secret'
  },
  {
    icon: <Layers size={22} />,
    title: 'Anti-Replay Protection',
    description: 'Monotonic sequence counters bound to authenticated session headers render duplicate, delayed, or out-of-order replay attacks impossible.',
    tag: 'SEQUENCE BOUND',
    spec: 'Anti-Replay'
  },
  {
    icon: <Radio size={22} />,
    title: 'WebSocket & TCP Parity',
    description: 'Standardized transport abstraction allows browser clients and desktop daemons to interoperate with identical ciphertext invariants.',
    tag: 'WS / TCP DUAL',
    spec: 'Protocol Parity'
  },
  {
    icon: <Cpu size={22} />,
    title: 'Client-Side Key Isolation',
    description: 'All identity generation, diffie-hellman handshakes, and decryption operations run strictly inside isolated client execution contexts.',
    tag: 'LOCAL STORAGE',
    spec: 'Hardware Guard'
  }
];

export function FeaturesSection() {
  return (
    <section className="features-section" id="features">
      <div className="features-container">
        {/* Header */}
        <div className="features-header-wrapper">
          <span className="features-badge">02 Features</span>
          <h2 className="features-main-title">Core Security Capabilities</h2>
          <p className="features-main-subtitle">
            Discover the foundational cryptographic primitives engineered to ensure your communications remain untraceable, tamper-proof, and private by default.
          </p>
        </div>

        {/* Tailark Features-8 Grid */}
        <div className="features-8-grid">
          {featureList.map((item, index) => (
            <motion.div
              key={index}
              className="f8-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              <div className="f8-card-top">
                <div className="f8-icon-box">{item.icon}</div>
                <h3 className="f8-card-title">{item.title}</h3>
                <p className="f8-card-desc">{item.description}</p>
              </div>

              <div className="f8-card-foot">
                <span>{item.spec}</span>
                <span className="f8-tag emerald">{item.tag}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
