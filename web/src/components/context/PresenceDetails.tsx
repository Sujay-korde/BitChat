import styles from './ContextPanel.module.css';
import { useConversationStore } from '../../state/conversationStore';

export function PresenceDetails() {
  const { activePeer, presence } = useConversationStore();
  
  let statusText = 'Offline';
  let dotColor = 'var(--color-text-secondary)';

  if (activePeer) {
    const statusVal = presence[activePeer] || Object.entries(presence).find(([key, s]) => 
      (key === activePeer || key.endsWith(`:${activePeer}`)) && (s === 'online' || s === 'active' || s === 'away')
    )?.[1];

    if (statusVal === 'online' || statusVal === 'active') {
      statusText = 'Active Now';
      dotColor = '#23a55a';
    } else if (statusVal === 'away') {
      statusText = 'Away';
      dotColor = '#f0b232';
    }
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Presence</h2>
      {activePeer ? (
        <div style={{ 
          fontSize: 'var(--text-sm)', 
          color: dotColor,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: dotColor
          }} />
          {statusText}
        </div>
      ) : (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          No peer selected
        </div>
      )}
    </div>
  );
}
