import styles from './ConversationHeader.module.css';
import { useConversationStore } from '../../state/conversationStore';

interface ConversationHeaderProps {
  peer: string;
}

export function ConversationHeader({ peer }: ConversationHeaderProps) {
  const rooms = useConversationStore(state => state.rooms);
  const isRoom = rooms.includes(peer);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {isRoom ? (
          <span className={styles.channelIcon}>#</span>
        ) : (
          <div className={styles.avatar}>
            {peer.substring(0, 2).toUpperCase()}
          </div>
        )}
        <div className={styles.details}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{peer}</h1>
            <span className={styles.badge}>{isRoom ? 'channel' : 'direct message'}</span>
          </div>
          <div className={styles.status}>
            <span className={styles.secureDot} />
            <span>{isRoom ? 'Megolm Sender-Key Group Encryption' : 'Pairwise Double-Ratchet Session'}</span>
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.securityShield} title="All communications are cryptographically authenticated and encrypted client-side">
          <span>🔒</span>
          <span>E2EE Active</span>
        </div>
      </div>
    </header>
  );
}
