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
  const cleanPeer = peer.trim().replace(/^[#@]+/, '').toLowerCase();
  const isRoom = rooms.some(r => r.trim().replace(/^[#@]+/, '').toLowerCase() === cleanPeer);

  const statusVal = !isRoom
    ? (presence[cleanPeer] || presence[peer] || Object.entries(presence).find(([key, s]) =>
        (key === cleanPeer || key === peer || key.endsWith(`:${cleanPeer}`) || key.endsWith(`:${peer}`)) && (s === 'online' || s === 'active' || s === 'away')
      )?.[1])
    : null;

  const isOnline = statusVal === 'online' || statusVal === 'active';
  const isAway = statusVal === 'away';

  const roomMembers = isRoom
    ? Object.entries(presence).filter(([k, s]) => 
        k.startsWith(`${cleanPeer}:`) && (s === 'online' || s === 'active' || s === 'joined')
      )
    : [];
  const roomOnlineCount = Math.max(1, roomMembers.length + 1);

  const handleDelete = () => {
    if (isRoom) {
      client.leaveRoom(cleanPeer).catch(console.error);
    }
    deleteChat(cleanPeer);
    setShowConfirm(false);
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {isRoom ? (
          <span className={styles.channelIcon}>#</span>
        ) : (
          <div className={styles.avatar} style={{ position: 'relative' }}>
            {cleanPeer.substring(0, 2).toUpperCase()}
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
            <h1 className={styles.title}>{isRoom ? `#${cleanPeer}` : cleanPeer}</h1>
            <span className={styles.badge}>{isRoom ? 'text channel' : 'direct message'}</span>
            
            {/* Explicit Online / Offline Tag */}
            {isRoom ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: 'rgba(35, 165, 90, 0.15)',
                  color: '#23a55a',
                  marginLeft: '8px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#23a55a',
                  }}
                />
                {roomOnlineCount} Active
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: isOnline ? 'rgba(35, 165, 90, 0.15)' : isAway ? 'rgba(240, 178, 50, 0.15)' : 'rgba(128, 132, 142, 0.15)',
                  color: isOnline ? '#23a55a' : isAway ? '#f0b232' : '#949ba4',
                  marginLeft: '8px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isOnline ? '#23a55a' : isAway ? '#f0b232' : '#80848e',
                  }}
                />
                {isOnline ? 'Online' : isAway ? 'Away' : 'Offline'}
              </span>
            )}
          </div>
          <div className={styles.status}>
            {isRoom ? (
              <>
                <span className={styles.secureDot} />
                <span>Group Channel • {roomOnlineCount} Online • Shared E2EE</span>
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
