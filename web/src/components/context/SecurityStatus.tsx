import styles from './ContextPanel.module.css';
import { StatusIndicator } from '../ui/StatusIndicator';
import { useConnectionStore } from '../../state/connectionStore';
import { ConnectionState } from '../../core/client/events';

export function SecurityStatus() {
  const { state } = useConnectionStore();

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Security</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <StatusIndicator variant={state === ConnectionState.READY ? 'secure' : 'warning'} />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
            {state === ConnectionState.READY ? 'Connection established' : 'Not connected'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <StatusIndicator variant={state === ConnectionState.READY ? 'secure' : 'warning'} />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
            {state === ConnectionState.READY ? 'End-to-end encryption available' : 'Encryption unavailable'}
          </span>
        </div>
      </div>
    </div>
  );
}
