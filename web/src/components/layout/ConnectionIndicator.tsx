import styles from './ConnectionIndicator.module.css';
import { useConnectionStore } from '../../state/connectionStore';
import { ConnectionState } from '../../core/client/events';

export function ConnectionIndicator() {
  const { state } = useConnectionStore();

  const getStatusDisplay = () => {
    switch (state) {
      case ConnectionState.READY:
        return { label: 'Connected', color: 'var(--color-secure)' };
      case ConnectionState.CONNECTING:
      case ConnectionState.AUTHENTICATING:
      case ConnectionState.RECONNECTING:
        return { label: 'Connecting...', color: 'var(--color-warning)' };
      case ConnectionState.DISCONNECTED:
      default:
        return { label: 'Disconnected', color: 'var(--color-danger)' };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className={styles.indicator} aria-label={`Connection status: ${status.label}`}>
      <div 
        className={styles.dot} 
        style={{ backgroundColor: status.color }} 
        aria-hidden="true"
      />
      <span className={styles.label}>{status.label}</span>
    </div>
  );
}
