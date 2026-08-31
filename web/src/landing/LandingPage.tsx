import { useEffect } from 'react';
import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { StorySection } from './StorySection';
import { FeaturesSection } from './FeaturesSection';
import { SolutionsCards } from './SolutionsCards';
import { FAQSection } from './FAQSection';
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
      <StorySection />

      {/* Neon Vertical Grid Background spanning from Features Section to Footer */}
      <div className="neon-grid-wrapper">
        <div className="neon-vertical-grid-overlay" />
        <FeaturesSection />
        <SolutionsCards />
        <FAQSection />
        <FinalCTA />
        <Footer />
      </div>
    </div>
  );
}

