import React, { useState } from 'react';
import styles from './ConnectionScreen.module.css';
import { useConnectionStore } from '../../state/connectionStore';
import { ConnectionState } from '../../core/client/events';

interface ConnectionScreenProps {
  onConnect: (username: string, serverUrl: string) => void;
}

const PREVIEW_WS_URL = 'wss://bitchat-preview-production.up.railway.app';
const CLOUD_WS_URL = 'wss://bitchat-prod-production.up.railway.app';
const LOCAL_WS_URL = 'ws://127.0.0.1:8766';
const MAX_USERNAME_LENGTH = 16;

export function ConnectionScreen({ onConnect }: ConnectionScreenProps) {
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const defaultServerUrl = (import.meta as any).env?.VITE_WS_URL || (isLocal ? LOCAL_WS_URL : CLOUD_WS_URL);
  const [username, setUsername] = useState('');
  const [serverUrl, setServerUrl] = useState(defaultServerUrl);
  const [warning, setWarning] = useState<string | null>(null);
  const { state, error } = useConnectionStore();

  const isConnecting = state === ConnectionState.CONNECTING || state === ConnectionState.AUTHENTICATING;

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val.length > MAX_USERNAME_LENGTH) {
      val = val.slice(0, MAX_USERNAME_LENGTH);
      setWarning(`Username cannot exceed ${MAX_USERNAME_LENGTH} characters.`);
    } else if (val.length === MAX_USERNAME_LENGTH) {
      setWarning(`Maximum length reached (${MAX_USERNAME_LENGTH} characters).`);
    } else {
      setWarning(null);
    }
    setUsername(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If the input is already at max length and user presses any printable character
    if (
      username.length >= MAX_USERNAME_LENGTH &&
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      setWarning(`Username cannot exceed ${MAX_USERNAME_LENGTH} characters.`);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (username.length + pasted.length > MAX_USERNAME_LENGTH) {
      setWarning(`Username cannot exceed ${MAX_USERNAME_LENGTH} characters.`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser) {
      setWarning('Username cannot be empty.');
      return;
    }
    if (cleanUser.length > MAX_USERNAME_LENGTH) {
      setWarning(`Username cannot exceed ${MAX_USERNAME_LENGTH} characters.`);
      return;
    }
    if (cleanUser && serverUrl.trim() && !isConnecting) {
      onConnect(cleanUser, serverUrl.trim());
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
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setServerUrl(PREVIEW_WS_URL)}
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: serverUrl === PREVIEW_WS_URL ? '1px solid #23a55a' : '1px solid var(--color-border)',
                  background: serverUrl === PREVIEW_WS_URL ? 'rgba(35, 165, 90, 0.2)' : 'var(--color-bg-surface-secondary)',
                  color: serverUrl === PREVIEW_WS_URL ? '#23a55a' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease'
                }}
              >
                🚀 Deployed Feature (Preview)
              </button>
              <button
                type="button"
                onClick={() => setServerUrl(CLOUD_WS_URL)}
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: serverUrl === CLOUD_WS_URL ? '1px solid #5865f2' : '1px solid var(--color-border)',
                  background: serverUrl === CLOUD_WS_URL ? 'rgba(88, 101, 242, 0.2)' : 'var(--color-bg-surface-secondary)',
                  color: serverUrl === CLOUD_WS_URL ? '#ffffff' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease'
                }}
              >
                ⚡ Production (Railway)
              </button>
              <button
                type="button"
                onClick={() => setServerUrl(LOCAL_WS_URL)}
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: serverUrl === LOCAL_WS_URL ? '1px solid #5865f2' : '1px solid var(--color-border)',
                  background: serverUrl === LOCAL_WS_URL ? 'rgba(88, 101, 242, 0.2)' : 'var(--color-bg-surface-secondary)',
                  color: serverUrl === LOCAL_WS_URL ? '#ffffff' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease'
                }}
              >
                💻 Localhost (127.0.0.1)
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="username" className={styles.label}>IDENTITY</label>
              <span
                className={`${styles.charCounter} ${username.length >= MAX_USERNAME_LENGTH ? styles.charCounterLimit : ''}`}
                aria-live="polite"
              >
                {username.length}/{MAX_USERNAME_LENGTH}
              </span>
            </div>
            <input
              id="username"
              type="text"
              value={username}
              onChange={handleUsernameChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              maxLength={MAX_USERNAME_LENGTH}
              placeholder="Select identity / create identity"
              className={`${styles.input} ${warning ? styles.inputWarning : ''}`}
              disabled={isConnecting}
              autoFocus
            />
            {warning && (
              <div className={styles.signalMessage} role="alert">
                <span className={styles.signalIcon}>⚠️</span>
                <span>{warning}</span>
              </div>
            )}
          </div>
          
          <button 
            type="submit" 
            className={styles.button}
            disabled={!username.trim() || username.trim().length > MAX_USERNAME_LENGTH || !serverUrl.trim() || isConnecting}
          >
            {getStatusText()}
          </button>
        </form>

        {error && (
          <div className={styles.errorContainer}>
            <p className={styles.errorTitle}>Connection could not be established</p>
            <p className={styles.errorMessage}>{error}</p>
            {(serverUrl.includes('127.0.0.1') || serverUrl.includes('localhost')) && (
              <p style={{ marginTop: '8px', fontSize: '11.5px', color: '#667781', lineHeight: '16px' }}>
                💡 <strong>Local backend is offline.</strong> Either start it in a terminal with:
                <br />
                <code style={{ background: '#e9edef', padding: '1px 5px', borderRadius: '3px' }}>python -m securechat.server.main</code>
                <br />
                or click <strong>⚡ Cloud (Railway)</strong> above to connect to the 24/7 cloud server.
              </p>
            )}
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
