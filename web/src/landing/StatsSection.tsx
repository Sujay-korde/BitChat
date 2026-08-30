import { motion, useInView, useSpring, useTransform } from 'framer-motion';
import { useRef, useEffect } from 'react';
import './StatsSection.css';

function AnimatedCounter({ value, duration = 2, suffix = '' }: { value: number, duration?: number, suffix?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const spring = useSpring(0, { duration: duration * 1000, bounce: 0 });
  const display = useTransform(spring, (current) => Math.floor(current) + suffix);

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, spring, value]);

  return <motion.span ref={ref}>{display}</motion.span>;
}

export function StatsSection() {
  const stats = [
    { value: 0, suffix: '', label: 'Bytes Decrypted Server-Side' },
    { value: 100, suffix: '%', label: 'Client-Side Execution' },
    { value: 256, suffix: '', label: 'Bit AES-GCM Cipher Strength' },
    { value: 25519, suffix: '', label: 'Curve for ECDH Key Exchange' },
    { value: 0, suffix: '', label: 'Single Points of Failure' },
  ];

  return (
    <section className="stats-section">
      <div className="stats-container">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card">
            <h3 className="stat-value">
              <AnimatedCounter value={stat.value} suffix={stat.suffix} />
            </h3>
            <p className="stat-label">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
