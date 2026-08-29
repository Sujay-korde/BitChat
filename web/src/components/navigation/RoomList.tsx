import styles from './List.module.css';

// Currently static as per instructions: "Do not hardcode these as fake production data. Use clearly marked development/mock state only where necessary."
// We will just show empty state or a mock structure for the layout.

export function RoomList() {
  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Rooms</h2>
      <ul className={styles.list}>
        {/* Placeholder for future rooms */}
        <li className={styles.emptyItem}>No active rooms</li>
      </ul>
    </div>
  );
}
