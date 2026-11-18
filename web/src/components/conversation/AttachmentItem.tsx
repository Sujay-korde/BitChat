import { useState, useEffect } from 'react';
import { client } from '../../App';
import type { AttachmentDescriptor } from '../../core/client/events';

interface AttachmentItemProps {
  descriptor: AttachmentDescriptor;
}

export function AttachmentItem({ descriptor }: AttachmentItemProps) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    async function loadMedia() {
      try {
        setLoading(true);
        setError(null);

        const baseUrl = client.getMediaBaseUrl();
        const res = await fetch(`${baseUrl}/api/media/${descriptor.blob_id}`);
        if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
        
        const ciphertextBuffer = await res.arrayBuffer();
        const ciphertext = new Uint8Array(ciphertextBuffer);

        const decryptedBytes = await client.decryptAttachment(
          ciphertext,
          descriptor.key,
          descriptor.iv,
          descriptor.sha256
        );

        if (!active) return;
        const blob = new Blob([decryptedBytes as unknown as BlobPart], { type: descriptor.mime_type });
        createdUrl = URL.createObjectURL(blob);
        setMediaUrl(createdUrl);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to decrypt media");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMedia();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [descriptor.blob_id, descriptor.key, descriptor.iv, descriptor.sha256, descriptor.mime_type]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = descriptor.mime_type.startsWith("image/");
  const isVideo = descriptor.mime_type.startsWith("video/");
  const isAudio = descriptor.mime_type.startsWith("audio/");

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      backgroundColor: '#2b2d31',
      border: '1px solid #1f2023',
      borderRadius: '8px',
      padding: '10px 12px',
      maxWidth: '520px',
      marginTop: '4px'
    }}>
      {loading && (
        <div style={{ fontSize: '12px', color: '#949ba4', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🔒 Decrypting end-to-end media...</span>
        </div>
      )}

      {error && (
        <div style={{ fontSize: '12px', color: '#f23f43' }}>
          ⚠️ {error}
        </div>
      )}

      {mediaUrl && (
        <>
          {isImage && (
            <img 
              src={mediaUrl} 
              alt={descriptor.file_name} 
              style={{ maxWidth: '100%', maxHeight: '340px', borderRadius: '6px', objectFit: 'contain' }} 
            />
          )}

          {isVideo && (
            <video 
              src={mediaUrl} 
              controls 
              style={{ maxWidth: '100%', maxHeight: '340px', borderRadius: '6px' }} 
            />
          )}

          {isAudio && (
            <audio 
              src={mediaUrl} 
              controls 
              style={{ maxWidth: '100%' }} 
            />
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingTop: '4px' }}>
            <span style={{ fontSize: '13px', color: '#f2f3f5', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📁 {descriptor.file_name} <span style={{ color: '#949ba4', fontSize: '11.5px' }}>({formatSize(descriptor.size)})</span>
            </span>
            <a 
              href={mediaUrl} 
              download={descriptor.file_name}
              style={{ 
                fontSize: '12px', 
                color: '#ffffff', 
                textDecoration: 'none', 
                fontWeight: 600,
                padding: '4px 10px',
                backgroundColor: '#5865f2',
                borderRadius: '4px',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4752c4')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#5865f2')}
            >
              Download
            </a>
          </div>
        </>
      )}

      {descriptor.caption && (
        <div style={{ fontSize: '14px', color: '#dbdee1', marginTop: '2px' }}>
          {descriptor.caption}
        </div>
      )}
    </div>
  );
}
