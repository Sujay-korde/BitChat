import React, { useState } from 'react';
import styles from './ConnectionScreen.module.css';
import { useConnectionStore } from '../../state/connectionStore';
import { ConnectionState } from '../../core/client/events';

interface ConnectionScreenProps {
  onConnect: (username: string) => void;
}

export function ConnectionScreen({ onConnect }: ConnectionScreenProps) {
  const [username, setUsername] = useState('');
  const { state, error } = useConnectionStore();

  const isConnecting = state === ConnectionState.CONNECTING || state === ConnectionState.AUTHENTICATING;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && !isConnecting) {
      onConnect(username.trim());
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>SecureChat</h1>
        
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="username" className={styles.label}>Identity</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className={styles.input}
              disabled={isConnecting}
              autoFocus
            />
          </div>
          
          <button 
            type="submit" 
            className={styles.button}
            disabled={!username.trim() || isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        </form>

        {state !== ConnectionState.DISCONNECTED && !error && (
          <div className={styles.status}>
            Status: {state}
          </div>
        )}

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
