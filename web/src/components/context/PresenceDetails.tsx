import styles from './ContextPanel.module.css';

export function PresenceDetails() {
  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Presence</h2>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
        Not available
      </div>
    </div>
  );
}
