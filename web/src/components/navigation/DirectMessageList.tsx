import styles from './List.module.css';

export function DirectMessageList() {
  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Direct Messages</h2>
      <ul className={styles.list}>
        <li className={styles.emptyItem}>No direct messages</li>
      </ul>
    </div>
  );
}
