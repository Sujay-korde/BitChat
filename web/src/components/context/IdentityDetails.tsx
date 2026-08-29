import styles from './ContextPanel.module.css';
import { useConnectionStore } from '../../state/connectionStore';
import { useConversationStore } from '../../state/conversationStore';

export function IdentityDetails() {
  const { username } = useConnectionStore();
  const { activePeer } = useConversationStore();

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Identity</h2>
      
      <div style={{ fontSize: 'var(--text-sm)' }}>
        <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>Current Session</div>
        <div className="mono" style={{ 
          fontSize: 'var(--text-xs)', 
          color: 'var(--color-text-muted)',
          wordBreak: 'break-all',
          backgroundColor: 'var(--color-bg-surface-elevated)',
          padding: 'var(--space-2)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border-subtle)',
          marginBottom: 'var(--space-4)'
        }}>
          {username ? `${username} (In-memory key)` : 'No identity'}
        </div>

        {activePeer && (
          <>
            <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>Peer</div>
            <div className="mono" style={{ 
              fontSize: 'var(--text-xs)', 
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-2)'
            }}>
              {activePeer}
            </div>
            
            <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>Identity verification</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Not available
            </div>
          </>
        )}
      </div>
    </div>
  );
}
