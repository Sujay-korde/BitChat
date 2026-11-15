import styles from './ConversationHeader.module.css';
import { StatusIndicator } from '../ui/StatusIndicator';

interface ConversationHeaderProps {
  peer: string;
}

export function ConversationHeader({ peer }: ConversationHeaderProps) {
  return (
    <header className={styles.header} style={{ backgroundColor: '#f0f2f5', padding: '10px 16px', borderBottom: '1px solid #d1d7db', display: 'flex', alignItems: 'center', height: '60px' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#dfe5e7', marginRight: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <svg viewBox="0 0 24 24" height="24" width="24" fill="#fff">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
        </svg>
      </div>
      <div className={styles.details} style={{ flex: 1 }}>
        <h1 className={styles.title} style={{ color: '#111b21', fontSize: '16px', fontWeight: 'normal', margin: 0 }}>{peer}</h1>
        <div className={styles.status} style={{ color: '#667781', fontSize: '13px' }}>
          <StatusIndicator variant="secure" />
          <span style={{ marginLeft: '4px' }}>End-to-end encrypted</span>
        </div>
      </div>
    </header>
  );
}
