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

function getAvatarGradient(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const gradients = [
    'linear-gradient(135deg, #5865f2, #4752c4)',
    'linear-gradient(135deg, #23a55a, #1a8346)',
    'linear-gradient(135deg, #f23f43, #c23135)',
    'linear-gradient(135deg, #f0b232, #c89326)',
    'linear-gradient(135deg, #eb459e, #b8337a)',
    'linear-gradient(135deg, #00a8fc, #0082c4)',
  ];
  return gradients[Math.abs(hash) % gradients.length];
}

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

  const formatTimestamp = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${timeStr}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${timeStr}`;
    return `${d.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' })} ${timeStr}`;
  };

  const getDateSeparatorLabel = (timestamp?: number): string => {
    if (!timestamp) return 'TODAY';
    const date = new Date(timestamp);
    const now = new Date();

    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    if (isSameDay(date, now)) {
      return 'TODAY';
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (isSameDay(date, yesterday)) {
      return 'YESTERDAY';
    }

    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  let lastDateLabel: string | null = null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingBottom: '8px' }}>
      {messages.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          textAlign: 'center',
          color: '#949ba4',
          gap: '12px',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#383a40',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
          }}>
            🔒
          </div>
          <h3 style={{ color: '#f2f3f5', fontSize: '20px', fontWeight: 600, margin: 0 }}>
            Welcome to {activePeer}!
          </h3>
          <p style={{ maxWidth: '420px', fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
            This is the start of your cryptographically secure session. Messages and attachments are end-to-end encrypted with zero server visibility.
          </p>
        </div>
      ) : (
        messages.map((msg, idx) => {
          const isOwn = msg.sender === currentUser;
          const attachment = tryParseAttachment(msg.text);
          const dateLabel = getDateSeparatorLabel(msg.timestamp);
          const showDateSeparator = dateLabel !== lastDateLabel;
          lastDateLabel = dateLabel;

          return (
            <div key={`${msg.id}-${idx}`} style={{ display: 'flex', flexDirection: 'column' }}>
              {showDateSeparator && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '20px 0 10px',
                  userSelect: 'none',
                  gap: '12px',
                }}>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#3f4147' }} />
                  <span style={{
                    padding: '2px 10px',
                    color: '#949ba4',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    {dateLabel}
                  </span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#3f4147' }} />
                </div>
              )}

              {/* Discord-style Message Row */}
              <div
                style={{
                  display: 'flex',
                  gap: '14px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  transition: 'background-color 0.12s ease',
                  marginTop: '2px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {/* Avatar */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: getAvatarGradient(msg.sender),
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '14px',
                  flexShrink: 0,
                  marginTop: '2px',
                }}>
                  {msg.sender.substring(0, 2).toUpperCase()}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 600, fontSize: '15px', color: '#f2f3f5' }}>
                      {msg.sender}
                    </span>
                    {isOwn && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: '#5865f2',
                        color: '#ffffff',
                        letterSpacing: '0.4px',
                      }}>
                        YOU
                      </span>
                    )}
                    <span style={{ fontSize: '12px', color: '#949ba4' }}>
                      {formatTimestamp(msg.timestamp)}
                    </span>
                    {isOwn && (
                      <span style={{
                        color: msg.status === MessageState.SENT ? '#5865f2' : (msg.status === MessageState.FAILED ? '#f23f43' : '#949ba4'),
                        fontSize: '12px',
                        fontWeight: 'bold',
                        marginLeft: '2px',
                      }}>
                        {msg.status === MessageState.SENT ? '✓✓' : (msg.status === MessageState.FAILED ? '!' : '✓')}
                      </span>
                    )}
                  </div>

                  <div style={{ color: '#dbdee1', fontSize: '15px', lineHeight: '1.45', wordBreak: 'break-word' }}>
                    {attachment ? (
                      <AttachmentItem descriptor={attachment} />
                    ) : (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                    )}
                  </div>
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
