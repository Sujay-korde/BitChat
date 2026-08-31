import { motion } from 'framer-motion';
import './FeaturesSection.css';

const bentoCards = [
  {
    stat: '0.00 ms',
    statLabel: 'PLAINTEXT LEAK WINDOW',
    title: 'Strict Client-Side Encryption',
    description: 'Messages are sealed in isolated browser memory using X25519 ECC key exchange before hitting the network socket.',
    spec: 'Handshake Phase',
    tag: 'EPHEMERAL KEYS'
  },
  {
    stat: '256-bit',
    statLabel: 'AES-GCM AEAD DEEP INTEGRITY',
    title: 'Authenticated Tag Verification',
    description: 'Every frame includes monotonic sequence numbers and AAD authentication headers, rendering message tampering mathematically impossible.',
    spec: 'Packet Validation',
    tag: 'TAG MATCH GUARANTEE'
  },
  {
    stat: '100%',
    statLabel: 'ZERO-KNOWLEDGE RELAY INGESTION',
    title: 'Opaque Ciphertext Routing',
    description: 'The central relay server ingests and routes encrypted packets without access to identity headers, plaintext content, or session metadata keys.',
    spec: 'Network Ingestion',
    tag: 'BLIND ROUTER'
  },
  {
    stat: '0 Bytes',
    statLabel: 'SERVER REPOSITORY KEY STORAGE',
    title: 'Double Ratchet Key Isolation',
    description: 'Session keys auto-rotate after every exchange turn. Even in the event of infrastructure compromise, historical payload secrecy remains intact.',
    spec: 'Session Ratchet',
    tag: 'FORWARD SECRECY'
  }
];

export function FeaturesSection() {
  return (
    <section className="features-section" id="features">
      <div className="features-container">
        {/* Header */}
        <div className="features-header-wrapper">
          <span className="features-badge">03 Features</span>
          <h2 className="features-main-title">Cryptographic Metrics & Guarantees</h2>
          <p className="features-main-subtitle">
            Core architectural benchmarks designed to eliminate telemetry, block replay attacks, and guarantee absolute forward secrecy.
          </p>
        </div>

        {/* 4-Card Bento Grid (2 Above, 2 Below) */}
        <div className="features-bento-grid">
          {bentoCards.map((card, index) => (
            <motion.div
              key={index}
              className="bento-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <div className="bento-card-top">
                <div className="bento-stat-wrapper">
                  <span className="bento-stat-val">{card.stat}</span>
                  <span className="bento-stat-label">{card.statLabel}</span>
                </div>
                <h3 className="bento-card-title">{card.title}</h3>
                <p className="bento-card-desc">{card.description}</p>
              </div>

              <div className="bento-card-foot">
                <span className="bento-foot-spec">{card.spec}</span>
                <span className="bento-foot-tag">{card.tag}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
