import { useEffect, useRef, useState } from 'react';
import { useConversationStore } from '../../state/conversationStore';
import { useConnectionStore } from '../../state/connectionStore';
import { MessageState } from '../../core/client/events';
import { AttachmentItem } from './AttachmentItem';
import type { AttachmentDescriptor } from '../../core/client/events';
import type { Message } from '../../state/conversationStore';

interface MessageListProps {
  activePeer: string;
}

const EMPTY_MESSAGES: Message[] = [];

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageList({ activePeer }: MessageListProps) {
  const cleanPeer = activePeer.trim().replace(/^[#@]+/, '').toLowerCase();
  const messages = useConversationStore(state => 
    state.messages[cleanPeer] || 
    state.messages[activePeer] || 
    (cleanPeer ? state.messages[`#${cleanPeer}`] : undefined) || 
    EMPTY_MESSAGES
  );
  const deleteMessage = useConversationStore(state => state.deleteMessage);
  const currentUser = useConnectionStore(state => state.username);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
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

  const tryParseUploading = (text: string): any | null => {
    if (!text || typeof text !== 'string' || !text.startsWith('{"type":"uploading_attachment"')) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
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

  const formatCompactTime = (ts?: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', paddingBottom: '12px' }}>
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
          const uploadingMeta = msg.isUploading || msg.uploadProgress !== undefined ? (tryParseUploading(msg.text) || {}) : tryParseUploading(msg.text);
          const isUploading = msg.isUploading || uploadingMeta !== null;
          const uploadProgress = msg.uploadProgress ?? uploadingMeta?.progress ?? 0;

          const dateLabel = getDateSeparatorLabel(msg.timestamp);
          const showDateSeparator = dateLabel !== lastDateLabel;
          lastDateLabel = dateLabel;

          // Message Grouping Calculation:
          // A message is consecutive if:
          // 1. Not the first message
          // 2. Previous message is by the same sender
          // 3. Not separated by a date header
          // 4. Sent within 5 minutes of previous message
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const isSameSender = prevMsg !== null && prevMsg.sender === msg.sender;
          const isWithinTime = prevMsg !== null && (msg.timestamp - prevMsg.timestamp) < 5 * 60 * 1000;
          const isConsecutive = !showDateSeparator && isSameSender && isWithinTime;

          const isHovered = hoveredMsgId === msg.id;

          // Circular progress math (radius 15, circumference = 2 * PI * 15 ~ 94.25)
          const radius = 15;
          const circumference = 2 * Math.PI * radius;
          const progressClamped = Math.min(100, Math.max(0, uploadProgress));
          const strokeDashoffset = circumference - (progressClamped / 100) * circumference;

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

              {/* Message Row */}
              <div
                style={{
                  display: 'flex',
                  padding: isConsecutive ? '3px 12px 3px 12px' : '6px 12px 3px 12px',
                  marginTop: isConsecutive ? '1px' : '14px',
                  borderRadius: '6px',
                  transition: 'background-color 0.12s ease',
                  position: 'relative',
                  backgroundColor: isHovered ? 'rgba(255, 255, 255, 0.035)' : 'transparent',
                }}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
              >
                {/* Delete / Actions floating toolbar on hover */}
                {isHovered && (
                  <div style={{
                    position: 'absolute',
                    right: '16px',
                    top: isConsecutive ? '-10px' : '-4px',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#313338',
                    border: '1px solid #232428',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    zIndex: 10,
                  }}>
                    <button
                      onClick={() => deleteMessage(activePeer, msg.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#949ba4',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '3px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#f23f43';
                        e.currentTarget.style.backgroundColor = 'rgba(242, 63, 67, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#949ba4';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Delete message"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                )}

                {/* Left Gutter: Avatar (if start of group) OR timestamp on hover (if consecutive) */}
                <div style={{
                  width: '44px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  flexShrink: 0,
                  marginRight: '12px',
                }}>
                  {!isConsecutive ? (
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
                      userSelect: 'none',
                    }}>
                      {msg.sender.substring(0, 2).toUpperCase()}
                    </div>
                  ) : (
                    <div style={{
                      width: '40px',
                      textAlign: 'right',
                      fontSize: '10px',
                      color: isHovered ? '#949ba4' : 'transparent',
                      marginTop: '3px',
                      userSelect: 'none',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {formatCompactTime(msg.timestamp)}
                    </div>
                  )}
                </div>

                {/* Right Body: Header + Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {!isConsecutive && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
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
                      {msg.status === MessageState.FAILED && (
                        <span style={{
                          color: '#f23f43',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: 'rgba(242, 63, 67, 0.1)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                        }}>
                          Failed to send
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message Content */}
                  <div style={{ color: '#dbdee1', fontSize: '15px', lineHeight: '1.45', wordBreak: 'break-word' }}>
                    {isUploading ? (
                      /* Discord-style Uploading Media Card with Circular Progress Dial */
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '12px 16px',
                        backgroundColor: '#2b2d31',
                        border: '1px solid #1f2023',
                        borderRadius: '8px',
                        maxWidth: '460px',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                      }}>
                        {/* Circular Progress Dial */}
                        <div style={{ position: 'relative', width: '42px', height: '42px', flexShrink: 0 }}>
                          <svg width="42" height="42" viewBox="0 0 42 42">
                            {/* Track circle */}
                            <circle
                              cx="21"
                              cy="21"
                              r={radius}
                              fill="transparent"
                              stroke="#383a40"
                              strokeWidth="3.5"
                            />
                            {/* Animated progress circle */}
                            <circle
                              cx="21"
                              cy="21"
                              r={radius}
                              fill="transparent"
                              stroke="#5865f2"
                              strokeWidth="3.5"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeDashoffset}
                              strokeLinecap="round"
                              transform="rotate(-90 21 21)"
                              style={{ transition: 'stroke-dashoffset 0.25s ease' }}
                            />
                          </svg>
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '42px',
                            height: '42px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#ffffff',
                          }}>
                            {progressClamped}%
                          </div>
                        </div>

                        {/* File Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: 600,
                            fontSize: '14px',
                            color: '#f2f3f5',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {uploadingMeta?.file_name || 'Uploading attachment...'}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#949ba4',
                            marginTop: '2px',
                            display: 'flex',
                            gap: '6px',
                            alignItems: 'center',
                          }}>
                            {uploadingMeta?.file_size && (
                              <span>{formatFileSize(uploadingMeta.file_size)}</span>
                            )}
                            <span>•</span>
                            <span style={{ color: '#5865f2', fontWeight: 500 }}>
                              {100 - progressClamped}% left
                            </span>
                          </div>
                          {uploadingMeta?.caption && (
                            <div style={{ marginTop: '4px', fontSize: '13px', color: '#dbdee1' }}>
                              {uploadingMeta.caption}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : attachment ? (
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
