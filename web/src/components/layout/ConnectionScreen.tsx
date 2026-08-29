import React, { useState } from 'react';
import styles from './ConnectionScreen.module.css';
import { useConnectionStore } from '../../state/connectionStore';
import { ConnectionState } from '../../core/client/events';

interface ConnectionScreenProps {
  onConnect: (username: string, serverUrl: string) => void;
}

export function ConnectionScreen({ onConnect }: ConnectionScreenProps) {
  const [username, setUsername] = useState('');
  const [serverUrl, setServerUrl] = useState('ws://127.0.0.1:8766');
  const { state, error } = useConnectionStore();

  const isConnecting = state === ConnectionState.CONNECTING || state === ConnectionState.AUTHENTICATING;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && serverUrl.trim() && !isConnecting) {
      onConnect(username.trim(), serverUrl.trim());
    }
  };

  const getStatusText = () => {
    switch (state) {
      case ConnectionState.CONNECTING:
        return 'Connecting...';
      case ConnectionState.AUTHENTICATING:
        return 'Authenticating identity...';
      case ConnectionState.READY:
        return 'Establishing secure session...';
      default:
        return 'Connect';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>SecureChat</h1>
          <p className={styles.subtitle}>
            Private communication,<br />
            designed around client-side security.
          </p>
        </div>

        <div className={styles.divider} />

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="serverUrl" className={styles.label}>SERVER</label>
            <input
              id="serverUrl"
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="ws://localhost:8766"
              className={styles.input}
              disabled={isConnecting}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="username" className={styles.label}>IDENTITY</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Select identity / create identity"
              className={styles.input}
              disabled={isConnecting}
              autoFocus
            />
          </div>
          
          <button 
            type="submit" 
            className={styles.button}
            disabled={!username.trim() || !serverUrl.trim() || isConnecting}
          >
            {getStatusText()}
          </button>
        </form>

        {error && (
          <div className={styles.errorContainer}>
            <p className={styles.errorTitle}>Connection could not be established</p>
            <p className={styles.errorMessage}>{error}</p>
          </div>
        )}

        <div className={styles.divider} />

        <div className={styles.footerSpecs}>
          <div className={styles.spec}>
            <span className={styles.specLabel}>Transport</span>
            <span className={styles.specValue}>WebSocket</span>
          </div>
          <div className={styles.spec}>
            <span className={styles.specLabel}>Identity</span>
            <span className={styles.specValue}>Ed25519</span>
          </div>
          <div className={styles.spec}>
            <span className={styles.specLabel}>Encryption</span>
            <span className={styles.specValue}>AES-256-GCM</span>
          </div>
        </div>
      </div>
    </div>
  );
}
