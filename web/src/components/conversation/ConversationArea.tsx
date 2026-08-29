import styles from './ConversationArea.module.css';
import { ConversationHeader } from './ConversationHeader';
import { ConversationEmptyState } from './ConversationEmptyState';
import { Composer } from './Composer';
import { MessageList } from './MessageList';

interface ConversationAreaProps {
  activePeer: string | null;
}

export function ConversationArea({ activePeer }: ConversationAreaProps) {
  if (!activePeer) {
    return (
      <main className={styles.area} aria-label="Conversation">
        <ConversationEmptyState />
      </main>
    );
  }

  return (
    <main className={styles.area} aria-label="Conversation">
      <ConversationHeader peer={activePeer} />
      <div className={styles.messageList} role="log" aria-live="polite">
        <MessageList activePeer={activePeer} />
      </div>
      <div className={styles.composerWrapper}>
        <Composer activePeer={activePeer} />
      </div>
    </main>
  );
}
