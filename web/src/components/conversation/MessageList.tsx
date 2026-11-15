import { useEffect, useRef } from 'react';
import { useConversationStore } from '../../state/conversationStore';
import { useConnectionStore } from '../../state/connectionStore';
import { MessageState } from '../../core/client/events';
import { AttachmentItem } from './AttachmentItem';
import type { AttachmentDescriptor } from '../../core/client/events';

interface MessageListProps {
  activePeer: string;
}

const EMPTY_MESSAGES: any[] = [];

export function MessageList({ activePeer }: MessageListProps) {
  const messages = useConversationStore(state => state.messages[activePeer] || EMPTY_MESSAGES);
  const currentUser = useConnectionStore(state => state.username);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const tryParseAttachment = (text: string): AttachmentDescriptor | null => {
    if (!text || typeof text !== 'string' || !text.startsWith('{"type":"attachment"')) {
      return null;
    }
    try {
      const parsed = JSON.parse(text);
      if (
        parsed.type === 'attachment' &&
        typeof parsed.blob_id === 'string' &&
        typeof parsed.key === 'string' &&
        typeof parsed.iv === 'string' &&
        typeof parsed.sha256 === 'string'
      ) {
        return parsed as AttachmentDescriptor;
      }
    } catch {
      // not JSON
    }
    return null;
  };

  const formatTime = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {messages.length === 0 ? (
        <div style={{ color: '#667781', textAlign: 'center', marginTop: '32px', fontSize: '14px' }}>
          🔒 Messages and calls are end-to-end encrypted. No one outside of this chat can read them.
        </div>
      ) : (
        messages.map((msg, idx) => {
          const isOwn = msg.sender === currentUser;
          const attachment = tryParseAttachment(msg.text);

          return (
            <div key={`${msg.id}-${idx}`} style={{
              alignSelf: isOwn ? 'flex-end' : 'flex-start',
              maxWidth: '68%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              marginBottom: '2px'
            }}>
              {!isOwn && (
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#128c7e',
                  marginBottom: '2px',
                  paddingLeft: '4px'
                }}>
                  {msg.sender}
                </div>
              )}
              <div style={{
                background: isOwn ? '#d9fdd3' : '#ffffff',
                color: '#111b21',
                padding: '6px 9px 8px 10px',
                borderRadius: isOwn ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
                boxShadow: '0 1px 0.5px rgba(11, 20, 26, 0.13)',
                wordBreak: 'break-word',
                position: 'relative',
                display: 'inline-block',
                minWidth: '90px'
              }}>
                {attachment ? (
                  <AttachmentItem descriptor={attachment} />
                ) : (
                  <span style={{ fontSize: '14.2px', lineHeight: '19px', whiteSpace: 'pre-wrap' }}>
                    {msg.text}
                  </span>
                )}
                <div style={{
                  float: 'right',
                  margin: '4px 0 -2px 8px',
                  fontSize: '11px',
                  color: '#667781',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>{formatTime(msg.timestamp)}</span>
                  {isOwn && (
                    <span style={{
                      color: msg.status === MessageState.SENT ? '#53bdeb' : (msg.status === MessageState.FAILED ? '#ea0038' : '#8696a0'),
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {msg.status === MessageState.SENT ? '✓✓' : (msg.status === MessageState.FAILED ? '!' : '✓')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}
