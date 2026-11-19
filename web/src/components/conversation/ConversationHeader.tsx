import { useState } from 'react';
import styles from './ConversationHeader.module.css';
import { useConversationStore } from '../../state/conversationStore';
import { client } from '../../App';

interface ConversationHeaderProps {
  peer: string;
}

export function ConversationHeader({ peer }: ConversationHeaderProps) {
  const { rooms, presence, deleteChat } = useConversationStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const isRoom = rooms.includes(peer);

  const statusVal = !isRoom
    ? (presence[peer] || Object.entries(presence).find(([key, s]) =>
        (key === peer || key.endsWith(`:${peer}`)) && (s === 'online' || s === 'active' || s === 'away')
      )?.[1])
    : null;

  const isOnline = statusVal === 'online' || statusVal === 'active';
  const isAway = statusVal === 'away';

  const handleDelete = () => {
    if (isRoom) {
      client.leaveRoom(peer).catch(console.error);
    }
    deleteChat(peer);
    setShowConfirm(false);
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {isRoom ? (
          <span className={styles.channelIcon}>#</span>
        ) : (
          <div className={styles.avatar} style={{ position: 'relative' }}>
            {peer.substring(0, 2).toUpperCase()}
            {(isOnline || isAway) && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '-1px',
                  right: '-1px',
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor: isOnline ? '#23a55a' : '#f0b232',
                  border: '2px solid var(--color-bg-base)',
                }}
              />
            )}
          </div>
        )}
        <div className={styles.details}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{peer}</h1>
            <span className={styles.badge}>{isRoom ? 'channel' : 'direct message'}</span>
          </div>
          <div className={styles.status}>
            {isRoom ? (
              <>
                <span className={styles.secureDot} />
                <span>Room Group Encryption</span>
              </>
            ) : (
              <>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isOnline ? '#23a55a' : isAway ? '#f0b232' : 'var(--color-text-muted)',
                    display: 'inline-block',
                  }}
                />
                <span>
                  {isOnline ? 'Active Now' : isAway ? 'Away' : 'Offline'} • Pairwise E2EE
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={styles.right}>
        {showConfirm ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#f23f43', fontWeight: 500 }}>
              {isRoom ? 'Leave channel?' : 'Delete chat?'}
            </span>
            <button
              onClick={handleDelete}
              style={{
                backgroundColor: '#f23f43',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Yes
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              style={{
                backgroundColor: 'transparent',
                color: '#949ba4',
                border: '1px solid #4e5058',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className={styles.deleteButton}
            onClick={() => setShowConfirm(true)}
            title={isRoom ? 'Leave and delete channel' : 'Delete conversation'}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>{isRoom ? 'Leave Room' : 'Delete Chat'}</span>
          </button>
        )}

        <div className={styles.securityShield} title="All communications are cryptographically authenticated and encrypted client-side">
          <span>🔒</span>
          <span>E2EE Active</span>
        </div>
      </div>
    </header>
  );
}
