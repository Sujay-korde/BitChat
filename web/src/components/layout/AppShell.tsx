import { useState } from 'react';
import styles from './AppShell.module.css';
import { NavigationPanel } from '../navigation/NavigationPanel';
import { ConversationArea } from '../conversation/ConversationArea';
import { ContextPanel } from '../context/ContextPanel';
import { TopBar } from './TopBar';
import { ConnectionIndicator } from './ConnectionIndicator';
import { client } from '../../App';
import { useConversationStore } from '../../state/conversationStore';

export function AppShell() {
  // Mobile responsive state (which pane is active)
  const [activePane, setActivePane] = useState<'nav' | 'conversation' | 'context'>('conversation');
  
  const { activePeer } = useConversationStore();

  return (
    <div className={styles.shell}>
      {/* Mobile Top Bar */}
      <div className={styles.mobileTopBar}>
        <TopBar 
          activePane={activePane}
          onPaneChange={setActivePane}
          onDisconnect={() => client.disconnect()}
        />
      </div>

      <div className={styles.panes}>
        {/* Left Navigation */}
        <div className={`${styles.pane} ${styles.navPane} ${activePane === 'nav' ? styles.activeMobile : ''}`}>
          <NavigationPanel />
        </div>

        {/* Center Conversation */}
        <div className={`${styles.pane} ${styles.mainPane} ${activePane === 'conversation' ? styles.activeMobile : ''}`}>
          <ConversationArea activePeer={activePeer} />
        </div>

        {/* Right Context */}
        <div className={`${styles.pane} ${styles.contextPane} ${activePane === 'context' ? styles.activeMobile : ''}`}>
          <ContextPanel />
        </div>
      </div>

      {/* Bottom Connection Status */}
      <footer className={styles.footer}>
        <ConnectionIndicator />
      </footer>
    </div>
  );
}
