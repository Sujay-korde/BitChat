import styles from './ConversationHeader.module.css';
import { StatusIndicator } from '../ui/StatusIndicator';

interface ConversationHeaderProps {
  peer: string;
}

export function ConversationHeader({ peer }: ConversationHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.details}>
        <h1 className={styles.title}>{peer}</h1>
        <div className={styles.status}>
          <StatusIndicator variant="secure" />
          <span>Encrypted connection</span>
        </div>
      </div>
    </header>
  );
}
