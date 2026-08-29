import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import styles from './ComposerPlaceholder.module.css'; // Let's reuse the module CSS or create Composer.module.css
import { client } from '../../App';
import { useConnectionStore } from '../../state/connectionStore';
import { useConversationStore } from '../../state/conversationStore';
import { ConnectionState } from '../../core/client/events';

interface ComposerProps {
  activePeer: string;
}

export function Composer({ activePeer }: ComposerProps) {
  const [text, setText] = useState('');
  const { state } = useConnectionStore();
  const rooms = useConversationStore(state => state.rooms);
  
  const disabled = state !== ConnectionState.READY;

  const handleSend = () => {
    if (disabled || !text.trim()) return;
    
    if (rooms.includes(activePeer)) {
      client.sendRoomMessage(activePeer, text).catch(console.error);
    } else {
      client.sendDirectMessage(activePeer, text).catch(console.error);
    }
    setText('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.composer} aria-disabled={disabled}>
      <textarea
        className={styles.inputPlaceholder}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-primary)',
          resize: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          padding: '0',
          minHeight: '24px',
          maxHeight: '120px'
        }}
        placeholder={disabled ? "Connecting..." : "Message..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        aria-label="Message Composer"
      />
    </div>
  );
}
