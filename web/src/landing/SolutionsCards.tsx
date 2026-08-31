import { motion } from 'framer-motion';
import { ArrowUpRight, Shield, Zap, Key, EyeOff } from 'lucide-react';
import './SolutionsCards.css';

const features = [
  {
    title: 'Double Ratchet',
    description: 'Perfect Forward Secrecy and Post-Compromise Security guaranteed by rotating keys after every message.',
    icon: <Key size={24} />,
    color: 'rgba(85, 217, 139, 0.15)' // secure green glow
  },
  {
    title: 'WebSocket Transport',
    description: 'Instantaneous, persistent bidirectional communication that operates efficiently under volatile network conditions.',
    icon: <Zap size={24} />,
    color: 'rgba(59, 130, 246, 0.15)' // blue glow
  },
  {
    title: 'Cryptographic Identity',
    description: 'User identities are bound cryptographically to Ed25519 signing keys, making impersonation mathematically impossible.',
    icon: <Shield size={24} />,
    color: 'rgba(215, 170, 84, 0.15)' // warning/yellow glow
  },
  {
    title: 'Ciphertext-Only Relay',
    description: 'The server routes opaque blobs of data without possessing the key material necessary to decrypt or manipulate them.',
    icon: <EyeOff size={24} />,
    color: 'rgba(217, 107, 107, 0.15)' // danger/red glow
  }
];

export function SolutionsCards() {
  return (
    <section className="solutions-section">
      <div className="solutions-header">
        <h2 className="solutions-title">Protocol Primitives</h2>
        <p className="solutions-subtitle">The cryptographic foundation of SecureChat</p>
      </div>

      <div className="solutions-grid-wrapper">
        <div className="solutions-grid">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              className="solution-card"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div
                className="solution-glow"
                style={{ background: `radial-gradient(circle at 50% 0%, ${feature.color}, transparent 70%)` }}
              ></div>
              <div className="solution-content">
                <div className="solution-icon-wrapper">
                  {feature.icon}
                </div>
                <h3 className="solution-card-title">{feature.title}</h3>
                <p className="solution-card-desc">{feature.description}</p>
              </div>
              <button className="solution-action">
                <ArrowUpRight size={20} />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
