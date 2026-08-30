import { useState, Fragment } from 'react';
import './SecurityArchitecture.css';

const PIPELINE = [
  {
    id: 'ed25519',
    title: 'ED25519',
    subtitle: 'Identity',
    description: 'Cryptographic identity binding ensures peers are mathematically verified.'
  },
  {
    id: 'x25519',
    title: 'X25519',
    subtitle: 'Key Agreement',
    description: 'Diffie-Hellman key exchange establishes a shared secret over an insecure channel.'
  },
  {
    id: 'hkdf',
    title: 'HKDF-SHA256',
    subtitle: 'Key Derivation',
    description: 'Derives strong, cryptographically independent session keys from the shared secret.'
  },
  {
    id: 'aes',
    title: 'AES-256-GCM',
    subtitle: 'Authenticated Encryption',
    description: 'Authenticated encryption protects message confidentiality and integrity.'
  },
  {
    id: 'aad',
    title: 'AAD',
    subtitle: 'Metadata Binding',
    description: 'Binds routing metadata to the ciphertext so the relay cannot tamper with headers.'
  },
  {
    id: 'seq',
    title: 'SEQUENCE',
    subtitle: 'Replay Protection',
    description: 'Strict monotonic counters prevent attackers from replaying old messages.'
  },
  {
    id: 'relay',
    title: 'CIPHERTEXT',
    subtitle: 'Relay',
    description: 'The server receives only opaque bytes and routes them blindly to the recipient.'
  }
];

export function SecurityArchitecture() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section className="security-arch-section" id="security">
      <div className="sec-container">
        <h2 className="section-heading">
          SECURITY ISN'T A FEATURE.<br />
          IT'S THE ARCHITECTURE.
        </h2>
        
        <div className="pipeline-horizontal">
          {PIPELINE.map((stage, index) => (
            <Fragment key={stage.id}>
              <div 
                className={`pipeline-stage ${hovered === stage.id ? 'active' : ''} ${hovered && hovered !== stage.id ? 'dimmed' : ''}`}
                onMouseEnter={() => setHovered(stage.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="stage-header">
                  <span className="stage-title">{stage.title}</span>
                  <span className="stage-subtitle">{stage.subtitle}</span>
                </div>
                <div className="stage-explanation">
                  {stage.description}
                </div>
              </div>
              
              {index < PIPELINE.length - 1 && (
                <div className={`pipeline-connector ${hovered === stage.id || hovered === PIPELINE[index+1].id ? 'active' : ''}`}>
                  →
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
