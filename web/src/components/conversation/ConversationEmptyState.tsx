import styles from './ConversationEmptyState.module.css';

export function ConversationEmptyState() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h2 className={styles.title}>No conversation selected</h2>
        <p className={styles.description}>
          Select a room or direct message<br />
          to begin a secure conversation.
        </p>
      </div>
    </div>
  );
}
