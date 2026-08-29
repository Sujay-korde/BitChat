import styles from './ConversationArea.module.css';
import { ConversationHeader } from './ConversationHeader';
import { ConversationEmptyState } from './ConversationEmptyState';
import { ComposerPlaceholder } from './ComposerPlaceholder';

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
        {/* Placeholder for message list */}
      </div>
      <div className={styles.composerWrapper}>
        <ComposerPlaceholder />
      </div>
    </main>
  );
}
