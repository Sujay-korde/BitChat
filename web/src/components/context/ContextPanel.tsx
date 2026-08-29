import styles from './ContextPanel.module.css';
import { SecurityStatus } from './SecurityStatus';
import { IdentityDetails } from './IdentityDetails';
import { PresenceDetails } from './PresenceDetails';

export function ContextPanel() {
  return (
    <aside className={styles.panel} aria-label="Context and Security Details">
      <div className={styles.scrollArea}>
        <SecurityStatus />
        <IdentityDetails />
        <PresenceDetails />
      </div>
    </aside>
  );
}
