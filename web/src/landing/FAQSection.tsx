import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import './FAQSection.css';

const faqs = [
  {
    question: 'How is SecureChat different from other E2EE messengers?',
    answer: 'SecureChat enforces a strictly ciphertext-only relay architecture. Unlike other platforms that map identities or phone numbers on their servers, our relay knows absolutely nothing about who is talking or what they are saying.'
  },
  {
    question: 'Are there any central points of failure?',
    answer: 'The protocol is designed to be fully decentralized at the transport layer. While we provide a default relay, the client can be configured to use any WebSocket-compliant endpoint that adheres to the routing protocol.'
  },
  {
    question: 'What encryption primitives are used?',
    answer: 'We utilize a Double Ratchet implementation backed by X25519 for key exchange, Ed25519 for identity signatures, and AES-256-GCM for symmetric message encryption.'
  },
  {
    question: 'How does group chat scaling work?',
    answer: 'SecureChat utilizes Sender Keys for groups to minimize O(N) encryption overhead, allowing groups of up to thousands of participants without degrading device performance or battery life.'
  },
  {
    question: 'Is the protocol audited?',
    answer: 'The core cryptographic protocol is open-source and based on established Signal Protocol primitives. We are currently undergoing independent security verification.'
  }
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="faq-section">
      <div className="faq-container">
        
        {/* Left Column */}
        <div className="faq-header">
          <div className="faq-badge">FAQ</div>
          <h2 className="faq-title">Cryptographic Inquiries</h2>
          <p className="faq-subtitle">Deep dive into our threat model and protocol guarantees.</p>
          <a href="#" className="faq-link">Read the Security Whitepaper</a>
        </div>

        {/* Right Column */}
        <div className="faq-list">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className={`faq-item ${isOpen ? 'open' : ''}`}>
                <button 
                  className="faq-question" 
                  onClick={() => toggleFAQ(i)}
                  aria-expanded={isOpen}
                >
                  {faq.question}
                  <motion.div 
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={20} />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="faq-answer">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
