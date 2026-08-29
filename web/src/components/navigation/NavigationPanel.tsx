import styles from './NavigationPanel.module.css';
import { UserIdentity } from './UserIdentity';
import { RoomList } from './RoomList';
import { DirectMessageList } from './DirectMessageList';
import { useConnectionStore } from '../../state/connectionStore';

export function NavigationPanel() {
  const { username } = useConnectionStore();

  return (
    <nav className={styles.nav} aria-label="Main Navigation">
      <UserIdentity username={username || 'Unknown User'} />
      <div className={styles.scrollArea}>
        <RoomList />
        <DirectMessageList />
      </div>
    </nav>
  );
}
