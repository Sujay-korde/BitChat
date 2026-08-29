import { useEffect, useRef } from 'react';
import { useConversationStore } from '../../state/conversationStore';
import { useConnectionStore } from '../../state/connectionStore';
import { MessageState } from '../../core/client/events';

interface MessageListProps {
  activePeer: string;
}

export function MessageList({ activePeer }: MessageListProps) {
  const messages = useConversationStore(state => state.messages[activePeer] || []);
  const currentUser = useConnectionStore(state => state.username);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getStatusIcon = (status?: MessageState) => {
    switch (status) {
      case MessageState.PENDING: return '○';
      case MessageState.SENT: return '✓';
      case MessageState.FAILED: return '!';
      default: return '';
    }
  };

  return (
    <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {messages.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-8)' }}>
          No messages yet. Send a message to start the conversation.
        </div>
      ) : (
        messages.map((msg, idx) => {
          const isOwn = msg.sender === currentUser;
          return (
            <div key={`${msg.id}-${idx}`} style={{
              alignSelf: isOwn ? 'flex-end' : 'flex-start',
              maxWidth: '70%',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-muted)',
                textAlign: isOwn ? 'right' : 'left'
              }}>
                {msg.sender}
              </div>
              <div style={{
                background: isOwn ? 'var(--color-brand-primary)' : 'var(--color-bg-surface-elevated)',
                color: isOwn ? 'var(--color-bg-base)' : 'var(--color-text-primary)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                wordBreak: 'break-word'
              }}>
                {msg.text}
              </div>
              {isOwn && (
                <div style={{
                  fontSize: 'var(--text-xs)',
                  color: msg.status === MessageState.FAILED ? 'var(--color-danger)' : 'var(--color-text-muted)',
                  textAlign: 'right'
                }}>
                  {getStatusIcon(msg.status)} {msg.status}
                </div>
              )}
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}
