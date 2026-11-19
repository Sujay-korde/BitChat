import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent, ChangeEvent } from 'react';
import { client } from '../../App';
import { useConnectionStore } from '../../state/connectionStore';
import { useConversationStore } from '../../state/conversationStore';
import { ConnectionState, MessageState } from '../../core/client/events';
import type { AttachmentDescriptor } from '../../core/client/events';
import { EmojiPicker } from './EmojiPicker';

interface ComposerProps {
  activePeer: string;
}

export function Composer({ activePeer }: ComposerProps) {
  const [text, setText] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const { state, username: currentUser } = useConnectionStore();
  const rooms = useConversationStore(state => state.rooms);
  const addMessage = useConversationStore(state => state.addMessage);
  const deleteMessage = useConversationStore(state => state.deleteMessage);
  const updateMessageProgress = useConversationStore(state => state.updateMessageProgress);
  const updateMessage = useConversationStore(state => state.updateMessage);

  // The composer is only disabled when disconnected or authenticating — NEVER when uploading media!
  const disabled = state !== ConnectionState.READY;
  const emojiRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
        setShowEmojis(false);
      }
    };
    const handleKeyDownGlobal = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowEmojis(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDownGlobal);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDownGlobal);
    };
  }, []);

  const handleSend = () => {
    if (disabled || !text.trim()) return;
    const msgText = text.trim();
    const cleanPeer = activePeer.trim().replace(/^[#@]+/, '').toLowerCase();
    const isRoom = rooms.some(r => r.trim().replace(/^[#@]+/, '').toLowerCase() === cleanPeer);
    
    if (isRoom) {
      client.sendRoomMessage(cleanPeer, msgText).catch(console.error);
    } else {
      client.sendDirectMessage(cleanPeer, msgText).catch(console.error);
    }
    setText('');
    setShowEmojis(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert("Attachment exceeds 25 MB limit.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Immediately clear file input so user can choose more files or keep typing freely
    if (fileInputRef.current) fileInputRef.current.value = '';

    const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const sender = currentUser || 'Me';

    // Insert optimistic uploading message into the active conversation
    addMessage(activePeer, {
      id: uploadId,
      sender: sender,
      text: JSON.stringify({
        type: 'uploading_attachment',
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        progress: 0,
      }),
      timestamp: Date.now(),
      status: MessageState.PENDING,
      isUploading: true,
      uploadProgress: 0,
    });

    // Run non-blocking background upload without freezing the composer
    void (async () => {
      try {
        updateMessageProgress(uploadId, 10);
        const fileBytes = new Uint8Array(await file.arrayBuffer());

        const { ciphertext, descriptor } = await client.encryptAttachment(
          fileBytes,
          file.name,
          file.type || 'application/octet-stream'
        );
        updateMessageProgress(uploadId, 25);

        // Upload encrypted blob via XMLHttpRequest to monitor real-time upload progress
        const baseUrl = client.getMediaBaseUrl();
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${baseUrl}/api/media/upload`);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const pct = 25 + Math.round((evt.loaded / evt.total) * 70);
            updateMessageProgress(uploadId, Math.min(95, pct));
          }
        };

        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              updateMessageProgress(uploadId, 100);
              const resData = JSON.parse(xhr.responseText);
              const fullDescriptor: AttachmentDescriptor = {
                ...descriptor,
                blob_id: resData.blob_id,
              };

              const payloadStr = JSON.stringify(fullDescriptor);

              // Remove the temporary optimistic upload message
              deleteMessage(activePeer, uploadId);

              // Send the finalized encrypted attachment message
              const currentRooms = useConversationStore.getState().rooms;
              if (currentRooms.includes(activePeer)) {
                await client.sendRoomMessage(activePeer, payloadStr);
              } else {
                await client.sendDirectMessage(activePeer, payloadStr);
              }
            } catch (dispatchErr: any) {
              console.error("Failed to dispatch completed attachment:", dispatchErr);
              updateMessage(uploadId, {
                status: MessageState.FAILED,
                isUploading: false,
                error: dispatchErr.message || 'Failed to dispatch media'
              });
            }
          } else {
            updateMessage(uploadId, {
              status: MessageState.FAILED,
              isUploading: false,
              error: `Media upload failed: HTTP ${xhr.status}`
            });
          }
        };

        xhr.onerror = () => {
          updateMessage(uploadId, {
            status: MessageState.FAILED,
            isUploading: false,
            error: 'Network error uploading attachment'
          });
        };

        xhr.send(ciphertext as unknown as XMLHttpRequestBodyInit);
      } catch (err: any) {
        console.error("Failed to encrypt or upload attachment:", err);
        updateMessage(uploadId, {
          status: MessageState.FAILED,
          isUploading: false,
          error: err.message || 'Encryption failed'
        });
      }
    })();
  };

  const isRoom = rooms.includes(activePeer);
  const placeholderText = disabled ? "Connecting..." : `Message ${isRoom ? '#' : '@'}${activePeer}`;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '4px 12px',
      backgroundColor: '#383a40',
      borderRadius: '8px',
      gap: '8px',
      position: 'relative',
      minHeight: '44px',
    }}>
      {/* Full Emoji Panel Popover */}
      {showEmojis && (
        <div ref={emojiRef}>
          <EmojiPicker
            onSelect={(emoji) => {
              setText((prev) => prev + emoji);
              textareaRef.current?.focus();
            }}
            onClose={() => setShowEmojis(false)}
          />
        </div>
      )}
      
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {/* Attachment Button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        title="Attach file (End-to-end encrypted, non-blocking)"
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: '#4e5058',
          border: 'none',
          color: '#ffffff',
          fontSize: '16px',
          cursor: disabled ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          opacity: disabled ? 0.6 : 1,
          transition: 'background-color 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5d6069'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#4e5058'; }}
      >
        +
      </button>

      {/* Text Input Field - Never blocked by ongoing media uploads */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <textarea
          ref={textareaRef}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: '#f2f3f5',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            fontSize: '15px',
            padding: '4px 0',
            minHeight: '22px',
            maxHeight: '120px',
            lineHeight: '22px'
          }}
          placeholder={placeholderText}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
      </div>

      {/* Emoji Button */}
      <button 
        onClick={() => setShowEmojis(!showEmojis)}
        disabled={disabled}
        title="Emoji Panel"
        style={{
          background: 'none',
          border: 'none',
          fontSize: '20px',
          cursor: disabled ? 'default' : 'pointer',
          color: '#b5bac1',
          padding: '4px',
          opacity: disabled ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        😀
      </button>

      {/* Send Button */}
      <button 
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        title="Send Message"
        style={{
          background: (disabled || !text.trim()) ? 'transparent' : '#5865f2',
          border: 'none',
          borderRadius: '6px',
          cursor: (disabled || !text.trim()) ? 'default' : 'pointer',
          color: (disabled || !text.trim()) ? '#80848e' : '#ffffff',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.15s ease',
        }}
      >
        <svg viewBox="0 0 24 24" height="18" width="18" preserveAspectRatio="xMidYMid meet" fill="currentColor">
          <path d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845L1.101,21.757z"></path>
        </svg>
      </button>
    </div>
  );
}
