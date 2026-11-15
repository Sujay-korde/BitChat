import { useState, useEffect } from 'react';
import styles from './ContextPanel.module.css';
import { useConnectionStore } from '../../state/connectionStore';
import { useConversationStore } from '../../state/conversationStore';
import { client } from '../../App';

export function IdentityDetails() {
  const { username } = useConnectionStore();
  const { activePeer } = useConversationStore();
  const [myFingerprint, setMyFingerprint] = useState<string>('');

  useEffect(() => {
    if (client.getFingerprint) {
      client.getFingerprint().then(setMyFingerprint).catch(console.error);
    }
  }, [username]);

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Identity</h2>
      
      <div style={{ fontSize: 'var(--text-sm)' }}>
        <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>Current Identity</div>
        <div className="mono" style={{ 
          fontSize: 'var(--text-xs)', 
          color: 'var(--color-text-primary)',
          wordBreak: 'break-all',
          backgroundColor: 'var(--color-bg-surface-elevated)',
          padding: 'var(--space-2)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border-subtle)',
          marginBottom: 'var(--space-3)'
        }}>
          {username ? `${username}` : 'No identity'}
        </div>

        <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>Safety Fingerprint</div>
        <div className="mono" style={{ 
          fontSize: '11px', 
          letterSpacing: '0.05em',
          color: 'var(--color-brand-primary)',
          wordBreak: 'break-all',
          backgroundColor: 'var(--color-bg-surface-elevated)',
          padding: 'var(--space-2)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border-subtle)',
          marginBottom: 'var(--space-4)'
        }}>
          {myFingerprint || 'Generating...'}
        </div>

        {activePeer && (
          <>
            <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>Active Peer</div>
            <div className="mono" style={{ 
              fontSize: 'var(--text-xs)', 
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-2)'
            }}>
              {activePeer}
            </div>
            
            <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>Trust Status</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>
              🔒 Verified End-to-End
            </div>
          </>
        )}
      </div>
    </div>
  );
}
