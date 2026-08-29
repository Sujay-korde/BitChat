import styles from './ContextPanel.module.css';
import { useConversationStore } from '../../state/conversationStore';

export function PresenceDetails() {
  const { activePeer, presence } = useConversationStore();
  
  // Presence comes as room:user -> status. Since we only have DMs right now,
  // we check if the user is online in *any* context they share with us.
  let isOnline = false;
  if (activePeer) {
    isOnline = Object.entries(presence).some(([key, status]) => 
      key.includes(activePeer) && status === 'online'
    );
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Presence</h2>
      {activePeer ? (
        <div style={{ 
          fontSize: 'var(--text-sm)', 
          color: isOnline ? 'var(--color-success)' : 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isOnline ? 'var(--color-success)' : 'var(--color-text-secondary)'
          }} />
          {isOnline ? 'Online' : 'Offline'}
        </div>
      ) : (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          No peer selected
        </div>
      )}
    </div>
  );
}
