import { useEffect, useState } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import './ArchitecturePage.css';

export function ArchitecturePage() {
  // Active steps tracker
  const [activeNodes, setActiveNodes] = useState<Record<string, boolean>>({});
  const [activeBeams, setActiveBeams] = useState<Record<string, boolean>>({});
  const [rahulState, setRahulState] = useState({ text: '"Hey Pritam, are you free?"', cipher: false });
  const [relayState, setRelayState] = useState({ text: '░░░░░░░░░░░░', cipher: true });
  const [pritamState, setPritamState] = useState({ text: '░░░░░░░░░░░░', cipher: true });

  useEffect(() => {
    window.scrollTo(0, 0);

    let timeouts: ReturnType<typeof setTimeout>[] = [];

    const msg = '"Hey Pritam, are you free?"';
    const cipher = '░ 7F3A 91C2 ░';
    const mask = '░░░░░░░░░░░░';

    const runFlowchartAnimation = () => {
      setActiveNodes({});
      setActiveBeams({});
      setRahulState({ text: msg, cipher: false });
      setRelayState({ text: mask, cipher: true });
      setPritamState({ text: mask, cipher: true });

      // Step 1: Rahul Pipeline
      setActiveNodes(prev => ({ ...prev, step1_1: true }));

      timeouts.push(setTimeout(() => {
        setActiveBeams(prev => ({ ...prev, arrow1_1: true }));
        setActiveNodes(prev => ({ ...prev, step1_2: true }));
      }, 250));

      timeouts.push(setTimeout(() => {
        setActiveBeams(prev => ({ ...prev, arrow1_2: true }));
        setActiveNodes(prev => ({ ...prev, step1_3: true }));
        setRahulState({ text: cipher, cipher: true });
      }, 500));

      timeouts.push(setTimeout(() => {
        setActiveBeams(prev => ({ ...prev, arrow1_3: true }));
        setActiveNodes(prev => ({ ...prev, step1_4: true }));
      }, 750));

      // Step 2: Relay Pipeline
      timeouts.push(setTimeout(() => {
        setActiveNodes(prev => ({ ...prev, step2_1: true }));
        setRelayState({ text: cipher, cipher: true });
      }, 2000));

      timeouts.push(setTimeout(() => {
        setActiveBeams(prev => ({ ...prev, arrow2_1: true }));
        setActiveNodes(prev => ({ ...prev, step2_2: true }));
      }, 2250));

      timeouts.push(setTimeout(() => {
        setActiveBeams(prev => ({ ...prev, arrow2_2: true }));
        setActiveNodes(prev => ({ ...prev, step2_3: true }));
      }, 2500));

      timeouts.push(setTimeout(() => {
        setActiveBeams(prev => ({ ...prev, arrow2_3: true }));
        setActiveNodes(prev => ({ ...prev, step2_4: true }));
      }, 2750));

      timeouts.push(setTimeout(() => {
        setRelayState({ text: mask, cipher: true });
      }, 3100));

      // Step 3: Pritam Ingestion & Decrypt Pipeline
      timeouts.push(setTimeout(() => {
        setActiveNodes(prev => ({ ...prev, step3_1: true }));
        setPritamState({ text: cipher, cipher: true });
      }, 3900));

      timeouts.push(setTimeout(() => {
        setActiveBeams(prev => ({ ...prev, arrow3_1: true }));
        setActiveNodes(prev => ({ ...prev, step3_2: true }));
      }, 4150));

      timeouts.push(setTimeout(() => {
        setActiveBeams(prev => ({ ...prev, arrow3_2: true }));
        setActiveNodes(prev => ({ ...prev, step3_3: true }));
      }, 4350));

      timeouts.push(setTimeout(() => {
        setActiveBeams(prev => ({ ...prev, arrow3_3: true }));
        setActiveNodes(prev => ({ ...prev, step3_4: true }));
        setPritamState({ text: msg, cipher: false });
      }, 4600));
    };

    runFlowchartAnimation();
    const interval = setInterval(runFlowchartAnimation, 5000);

    return () => {
      clearInterval(interval);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="arch-page">
      <Navbar />

      <main className="arch-container">
        {/* Header Section */}
        <header className="arch-header">
          <span className="arch-badge">System Architecture & Protocol Spec</span>
          <h1 className="arch-title">End-to-End Cryptographic Flow</h1>
          <p className="arch-subtitle">
            A comprehensive blueprint illustrating zero-knowledge packet transit, local client-side key isolation, and authenticated AES-256-GCM transport verification across the SecureChat network.
          </p>
        </header>

        {/* Blueprint Flowchart */}
        <div className="arch-blueprint">
          <div className="arch-flowchart-grid">
            {/* COLUMN 1: RAHUL (SENDER) */}
            <div className="arch-zone trusted">
              <div className="arch-zone-banner trusted-text">
                <span>01 / Rahul</span>
                <span>Origin Node</span>
              </div>

              <div className={`arch-node-box ${activeNodes.step1_1 ? 'active-pulse' : ''}`}>
                <div className="arch-node-head">
                  <span className="arch-node-title">Composer UI</span>
                  <span className="arch-node-spec">React / State</span>
                </div>
              </div>

              <div className={`arch-v-arrow ${activeBeams.arrow1_1 ? 'active-beam' : ''}`}>
                <div className="arch-beam"></div>
              </div>

              <div className={`arch-node-box ${activeNodes.step1_2 ? 'active-pulse' : ''}`}>
                <div className="arch-node-head">
                  <span className="arch-node-title">Local Policy</span>
                  <span className="arch-node-spec emerald">Pre-Encrypt</span>
                </div>
              </div>

              <div className={`arch-v-arrow ${activeBeams.arrow1_2 ? 'active-beam' : ''}`}>
                <div className="arch-beam"></div>
              </div>

              <div className={`arch-node-box ${activeNodes.step1_3 ? 'active-pulse' : ''}`}>
                <div className="arch-node-head">
                  <span className="arch-node-title">X25519 + AES-GCM</span>
                  <span className="arch-node-spec emerald">Key Isolation</span>
                </div>
              </div>

              <div className={`arch-v-arrow ${activeBeams.arrow1_3 ? 'active-beam' : ''}`}>
                <div className="arch-beam"></div>
              </div>

              <div className={`arch-node-box ${activeNodes.step1_4 ? 'active-pulse' : ''}`}>
                <div className="arch-node-head">
                  <span className="arch-node-title">WebSocket Transport</span>
                  <span className="arch-node-spec">Serialization</span>
                </div>
              </div>
            </div>

            {/* COLUMN 2: RELAY (UNTRUSTED ROUTER) */}
            <div className="arch-zone untrusted">
              <div className="arch-zone-banner untrusted-text">
                <span>02 / Relay</span>
                <span>Zero-Knowledge</span>
              </div>

              <div className={`arch-node-box ${activeNodes.step2_1 ? 'active-relay' : ''}`} style={{ background: 'transparent' }}>
                <div className="arch-node-head">
                  <span className="arch-node-title">Transport Ingestion</span>
                  <span className="arch-node-spec">WS / TCP</span>
                </div>
              </div>

              <div className={`arch-v-arrow ${activeBeams.arrow2_1 ? 'active-beam' : ''}`}>
                <div className="arch-beam"></div>
              </div>

              <div className={`arch-node-box ${activeNodes.step2_2 ? 'active-relay' : ''}`} style={{ background: 'transparent' }}>
                <div className="arch-node-head">
                  <span className="arch-node-title">Message Router</span>
                  <span className="arch-node-spec">Session Match</span>
                </div>
              </div>

              <div className={`arch-v-arrow ${activeBeams.arrow2_2 ? 'active-beam' : ''}`}>
                <div className="arch-beam"></div>
              </div>

              <div className={`arch-node-box ${activeNodes.step2_3 ? 'active-relay' : ''}`} style={{ background: 'transparent' }}>
                <div className="arch-node-head">
                  <span className="arch-node-title">Header Inspection</span>
                  <span className="arch-node-spec">Plaintext: ✕</span>
                </div>
              </div>

              <div className={`arch-v-arrow ${activeBeams.arrow2_3 ? 'active-beam' : ''}`}>
                <div className="arch-beam"></div>
              </div>

              <div className={`arch-node-box ${activeNodes.step2_4 ? 'active-relay' : ''}`} style={{ background: 'transparent' }}>
                <div className="arch-node-head">
                  <span className="arch-node-title">Forward + Emit ACK</span>
                  <span className="arch-node-spec">Stream Out</span>
                </div>
              </div>
            </div>

            {/* COLUMN 3: PRITAM (RECEIVER) */}
            <div className="arch-zone trusted">
              <div className="arch-zone-banner trusted-text">
                <span>03 / Pritam</span>
                <span>Target Node</span>
              </div>

              <div className={`arch-node-box ${activeNodes.step3_1 ? 'active-pulse' : ''}`}>
                <div className="arch-node-head">
                  <span className="arch-node-title">WebSocket Transport</span>
                  <span className="arch-node-spec">Ingestion</span>
                </div>
              </div>

              <div className={`arch-v-arrow ${activeBeams.arrow3_1 ? 'active-beam' : ''}`}>
                <div className="arch-beam"></div>
              </div>

              <div className={`arch-node-box ${activeNodes.step3_2 ? 'active-pulse' : ''}`}>
                <div className="arch-node-head">
                  <span className="arch-node-title">AAD & Sequence</span>
                  <span className="arch-node-spec emerald">Anti-Replay</span>
                </div>
              </div>

              <div className={`arch-v-arrow ${activeBeams.arrow3_2 ? 'active-beam' : ''}`}>
                <div className="arch-beam"></div>
              </div>

              <div className={`arch-node-box ${activeNodes.step3_3 ? 'active-pulse' : ''}`}>
                <div className="arch-node-head">
                  <span className="arch-node-title">AES-256 Decrypt</span>
                  <span className="arch-node-spec emerald">Tag Match</span>
                </div>
              </div>

              <div className={`arch-v-arrow ${activeBeams.arrow3_3 ? 'active-beam' : ''}`}>
                <div className="arch-beam"></div>
              </div>

              <div className={`arch-node-box ${activeNodes.step3_4 ? 'active-pulse' : ''}`}>
                <div className="arch-node-head">
                  <span className="arch-node-title">Conversation UI</span>
                  <span className="arch-node-spec">Render</span>
                </div>
              </div>
            </div>

            {/* TRANSIT STAGE (LIVE MOTION HIGHWAY) */}
            <div className="arch-transit-stage">
              <div className="arch-transit-track"></div>

              <div className="arch-flying-packet">
                <div className="arch-packet-chip">░ 7F3A 91C2 ░</div>
              </div>

              <div className="arch-transit-grid">
                <div className="arch-transit-node-display">
                  <span className="arch-display-tag">Rahul Local State</span>
                  <span className={`arch-display-val ${rahulState.cipher ? 'cipher' : ''}`}>
                    {rahulState.text}
                  </span>
                </div>

                <div className="arch-transit-node-display relay-display">
                  <span className="arch-display-tag">Relay Payload</span>
                  <span className={`arch-display-val ${relayState.cipher ? 'cipher' : ''}`}>
                    {relayState.text}
                  </span>
                </div>

                <div className="arch-transit-node-display">
                  <span className="arch-display-tag">Pritam Local State</span>
                  <span className={`arch-display-val ${pritamState.cipher ? 'cipher' : ''}`}>
                    {pritamState.text}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Extra Information Section */}
        <section className="arch-info-section">
          <div className="arch-info-header">
            <h3>Protocol Verification & Architectural Guarantees</h3>
          </div>

          <div className="arch-info-grid">
            <div className="arch-info-card">
              <span className="arch-info-card-num">01 / KEY ISOLATION</span>
              <h4 className="arch-info-card-title">Client-Side Ephemeral Keying</h4>
              <p className="arch-info-card-desc">
                Identity and key exchange are computed using X25519 Elliptic Curve Cryptography directly inside the browser client memory. Private keys are never serialized, logged, or exposed across any network boundary.
              </p>
            </div>

            <div className="arch-info-card">
              <span className="arch-info-card-num">02 / ZERO-KNOWLEDGE RELAY</span>
              <h4 className="arch-info-card-title">Blind Packet Ingestion</h4>
              <p className="arch-info-card-desc">
                The central relay server functions as a blind router. It inspects only session metadata tags necessary to forward ciphertext frames (such as <code>7F3A 91C2</code>) to target nodes without reading payload content.
              </p>
            </div>

            <div className="arch-info-card">
              <span className="arch-info-card-num">03 / ANTI-REPLAY & AEAD</span>
              <h4 className="arch-info-card-title">Authenticated Additional Data (AAD)</h4>
              <p className="arch-info-card-desc">
                Every encrypted message payload includes a strict monotonic sequence number and session AAD header verified by AES-256-GCM authentication tags, completely mitigating replay and out-of-order injection attacks.
              </p>
            </div>

            <div className="arch-info-card">
              <span className="arch-info-card-num">04 / MULTI-TRANSPORT PARITY</span>
              <h4 className="arch-info-card-title">Dual-Adapter Transport Contract</h4>
              <p className="arch-info-card-desc">
                The messaging core decouples network transport logic into standardized client interfaces. Both native TCP sockets and WebSocket browser adapters enforce the same strict ciphertext invariant.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
