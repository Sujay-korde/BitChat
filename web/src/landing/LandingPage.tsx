import { useEffect } from 'react';
import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { StorySection } from './StorySection';
import { SolutionsCards } from './SolutionsCards';
import { FeaturesWheel } from './FeaturesWheel';
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
      <SolutionsCards />
      <FeaturesWheel />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}
