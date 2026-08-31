import React, { useState } from 'react';
import { motion } from 'framer-motion';
import './FeaturesSection.css';

const cardContents = [
  {
    badge: '100% OPAQUE ROUTING',
    title: 'Zero-Knowledge Blind Relay',
    description: 'The central relay server ingests and forwards opaque ciphertext frames without possessing key material, identity headers, or plaintext access.',
    metric: '0-KNOWLEDGE',
    tag: 'BLIND ROUTER',
    className: 'ruixen-col-span-3 ruixen-row-span-2'
  },
  {
    badge: '0.00ms PLAINTEXT LEAK',
    title: 'Client-Side Ephemeral Keying',
    description: 'All identity generation, diffie-hellman handshakes, and cryptographic encryption operations execute strictly inside isolated client memory contexts before hitting the network layer.',
    metric: 'X25519 ECC',
    tag: 'LOCAL ISOLATION',
    className: 'ruixen-col-span-3 ruixen-row-span-2'
  },
  {
    badge: '256-BIT AES-GCM + AAD',
    title: 'AEAD Integrity & Anti-Replay',
    description: 'Every frame incorporates monotonic sequence counters and Additional Authenticated Data (AAD) tags, rendering tampering, packet insertion, or out-of-order replay attacks mathematically impossible.',
    metric: 'AES-256-GCM',
    tag: 'TAG MATCH VERIFIED',
    className: 'ruixen-col-span-4 ruixen-row-span-1'
  },
  {
    badge: 'PERFECT FORWARD SECRECY',
    title: 'Double Ratchet Security',
    description: 'Session keys auto-rotate after every payload exchange. Historical conversation secrecy remains mathematically intact even in the event of future key compromise.',
    metric: 'FORWARD SECRET',
    tag: 'AUTO-RATCHET',
    className: 'ruixen-col-span-2 ruixen-row-span-1'
  },
  {
    badge: 'WEBSOCKET & TCP PARITY',
    title: 'Dual-Adapter Transport Contract',
    description: 'Standardized transport layer abstractions allow web browser clients and native desktop daemons to interoperate with identical ciphertext invariants under extreme network volatility.',
    metric: 'WS / TCP DUAL',
    tag: 'MULTI-TRANSPORT',
    className: 'ruixen-col-span-6 ruixen-row-span-1'
  }
];

const PlusIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.2"
    stroke="currentColor"
    className={`plus-icon ${className || ''}`}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
  </svg>
);

const CornerPlusIcons = () => (
  <>
    <PlusIcon className="top-left" />
    <PlusIcon className="top-right" />
    <PlusIcon className="bottom-left" />
    <PlusIcon className="bottom-right" />
  </>
);

const PlusCard: React.FC<{
  className?: string;
  badge: string;
  title: string;
  description: string;
  metric: string;
  tag: string;
}> = ({ className = '', badge, title, description, metric, tag }) => {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  return (
    <div
      className={`plus-card ${className}`}
      onMouseMove={handleMouseMove}
      style={{
        '--mouse-x': `${mousePos.x}%`,
        '--mouse-y': `${mousePos.y}%`,
      } as React.CSSProperties}
    >
      <CornerPlusIcons />
      <div className="plus-card-glow" />

      {/* Card Header & Body */}
      <div className="plus-card-body">
        <span className="plus-card-badge">{badge}</span>
        <h3 className="plus-card-title">{title}</h3>
        <p className="plus-card-desc">{description}</p>
      </div>

      {/* Card Footer Metric & Tag */}
      <div className="plus-card-foot">
        <span className="plus-foot-metric">{metric}</span>
        <span className="plus-foot-tag">{tag}</span>
      </div>
    </div>
  );
};

export function FeaturesSection() {
  return (
    <section className="features-section" id="features">
      {/* Top Ambient Glow */}
      <div className="features-ambient-glow" />

      <div className="features-container">
        {/* Header */}
        <div className="features-header-wrapper">
          <span className="features-badge">03 Features</span>
          <h2 className="features-main-title">Cryptographic Architecture Benchmarks</h2>
          <p className="features-main-subtitle">
            Core security primitives and layout benchmarks built for zero-knowledge privacy, high-throughput packet routing, and hardware key isolation.
          </p>
        </div>

        {/* Ruixen Bento Grid */}
        <div className="ruixen-grid">
          {cardContents.map((card, index) => (
            <motion.div
              key={index}
              className={card.className}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              <PlusCard
                badge={card.badge}
                title={card.title}
                description={card.description}
                metric={card.metric}
                tag={card.tag}
              />
            </motion.div>
          ))}
        </div>

        {/* Section Footer Heading */}
        <div className="features-footer-heading">
          <h2 className="features-footer-title">
            Built for secrecy. Engineered for absolute resilience.
          </h2>
          <p className="features-footer-desc">
            SecureChat provides the primitive guarantees necessary to build untraceable communications with zero trust assumptions on central routing nodes.
          </p>
        </div>
      </div>
    </section>
  );
}
