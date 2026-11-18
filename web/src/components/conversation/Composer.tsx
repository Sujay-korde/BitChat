import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent, ChangeEvent } from 'react';
import { client } from '../../App';
import { useConnectionStore } from '../../state/connectionStore';
import { useConversationStore } from '../../state/conversationStore';
import { ConnectionState } from '../../core/client/events';
import type { AttachmentDescriptor } from '../../core/client/events';

interface ComposerProps {
  activePeer: string;
}

const COMMON_EMOJIS = ['😀','😂','❤️','👍','🎉','🔥','🤔','👀','🙌','✨','😊','😎','😢','🙏','💯'];

export function Composer({ activePeer }: ComposerProps) {
  const [text, setText] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { state } = useConnectionStore();
  const rooms = useConversationStore(state => state.rooms);
  
  const disabled = state !== ConnectionState.READY || uploading;
  const emojiRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
        setShowEmojis(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = () => {
    if (disabled || !text.trim()) return;
    
    if (rooms.includes(activePeer)) {
      client.sendRoomMessage(activePeer, text).catch(console.error);
    } else {
      client.sendDirectMessage(activePeer, text).catch(console.error);
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

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert("Attachment exceeds 25 MB limit.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setUploading(true);
      const fileBytes = new Uint8Array(await file.arrayBuffer());

      const { ciphertext, descriptor } = await client.encryptAttachment(
        fileBytes,
        file.name,
        file.type || 'application/octet-stream'
      );

      // Upload encrypted blob to zero-knowledge out-of-band media server
      const baseUrl = client.getMediaBaseUrl();
      const uploadRes = await fetch(`${baseUrl}/api/media/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: ciphertext as unknown as BodyInit
      });

      if (!uploadRes.ok) {
        throw new Error(`Media upload failed with HTTP ${uploadRes.status}`);
      }

      const resData = await uploadRes.json();
      const fullDescriptor: AttachmentDescriptor = {
        ...descriptor,
        blob_id: resData.blob_id,
        caption: text.trim() ? text.trim() : undefined
      };

      const payloadStr = JSON.stringify(fullDescriptor);
      if (rooms.includes(activePeer)) {
        await client.sendRoomMessage(activePeer, payloadStr);
      } else {
        await client.sendDirectMessage(activePeer, payloadStr);
      }

      setText('');
    } catch (err) {
      console.error("Failed to encrypt or upload attachment:", err);
      alert(err instanceof Error ? err.message : "Failed to send attachment");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isRoom = rooms.includes(activePeer);
  const placeholderText = uploading 
    ? "Encrypting & uploading attachment..." 
    : (disabled ? "Connecting..." : `Message ${isRoom ? '#' : '@'}${activePeer}`);

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
      {showEmojis && (
        <div ref={emojiRef} style={{
          position: 'absolute',
          bottom: '100%',
          left: '0',
          marginBottom: '10px',
          backgroundColor: '#2b2d31',
          border: '1px solid #1f2023',
          borderRadius: '8px',
          padding: '10px',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '8px',
          boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
          zIndex: 10
        }}>
          {COMMON_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => setText(prev => prev + emoji)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                transition: 'background-color 0.1s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#35373c')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {emoji}
            </button>
          ))}
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
        title="Attach file (End-to-end encrypted)"
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: uploading ? '#5865f2' : '#4e5058',
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
        onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.backgroundColor = '#5d6069'; }}
        onMouseLeave={(e) => { if (!uploading) e.currentTarget.style.backgroundColor = '#4e5058'; }}
      >
        +
      </button>

      {/* Input Field */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <textarea
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
        title="Select Emoji"
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
