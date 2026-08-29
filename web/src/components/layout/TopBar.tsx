import styles from './TopBar.module.css';

interface TopBarProps {
  activePane: 'nav' | 'conversation' | 'context';
  onPaneChange: (pane: 'nav' | 'conversation' | 'context') => void;
  onDisconnect: () => void;
}

export function TopBar({ activePane, onPaneChange, onDisconnect }: TopBarProps) {
  return (
    <div className={styles.topbar}>
      <button 
        className={`${styles.tab} ${activePane === 'nav' ? styles.active : ''}`}
        onClick={() => onPaneChange('nav')}
      >
        Menu
      </button>
      <button 
        className={`${styles.tab} ${activePane === 'conversation' ? styles.active : ''}`}
        onClick={() => onPaneChange('conversation')}
      >
        Chat
      </button>
      <button 
        className={`${styles.tab} ${activePane === 'context' ? styles.active : ''}`}
        onClick={() => onPaneChange('context')}
      >
        Info
      </button>
      <button 
        className={styles.tab}
        onClick={onDisconnect}
        style={{ color: 'var(--color-danger)' }}
      >
        Exit
      </button>
    </div>
  );
}
