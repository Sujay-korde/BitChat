import styles from './Layout.module.css';
import { useConnectionStore } from '../../state/connectionStore';

export function Layout() {
  const { username } = useConnectionStore();

  return (
    <div className={styles.layout}>
      {/* Navigation Panel */}
      <aside className={styles.navigation}>
        <div className={styles.header}>SecureChat</div>
        <div className={styles.emptyState}>No active rooms</div>
      </aside>

      {/* Main Conversation Area */}
      <main className={styles.conversation}>
        <div className={styles.emptyState}>Select a conversation</div>
      </main>

      {/* Context Panel */}
      <aside className={styles.context}>
        <div className={styles.header}>Identity</div>
        <div style={{ color: 'var(--color-text-primary)' }}>{username}</div>
        <div style={{ marginTop: 'var(--space-8)' }} className={styles.header}>Security</div>
        <div style={{ color: 'var(--color-security)', fontSize: 'var(--text-sm)' }}>
          E2E Active (Placeholder)
        </div>
      </aside>
    </div>
  );
}
