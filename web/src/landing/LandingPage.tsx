import { useEffect } from 'react';
import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { EncryptionStory } from './EncryptionStory';
import { ProductShowcase } from './ProductShowcase';
import { SecurityArchitecture } from './SecurityArchitecture';
import { TransportArchitecture } from './TransportArchitecture';
import { RoomArchitecture } from './RoomArchitecture';
import { Resilience } from './Resilience';
import { SecuritySummary } from './SecuritySummary';
import { FinalCTA } from './FinalCTA';
import { Footer } from './Footer';

export function LandingPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-primary)' }}>
      <Navbar />
      <Hero />
      <EncryptionStory />
      <ProductShowcase />
      <SecurityArchitecture />
      <TransportArchitecture />
      <RoomArchitecture />
      <Resilience />
      <SecuritySummary />
      <FinalCTA />
      <Footer />
    </div>
  );
}
