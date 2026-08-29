import { useState } from 'react';
import styles from './List.module.css';
import { useConversationStore } from '../../state/conversationStore';
import { client } from '../../App';

export function DirectMessageList() {
  const { messages, rooms, activePeer, setActivePeer, presence } = useConversationStore();
  const [newPeer, setNewPeer] = useState('');

  // All message targets that are NOT rooms are considered DM peers
  const peers = Object.keys(messages).filter(t => !rooms.includes(t));
  
  // We should also include peers we might have exchanged keys with but haven't messaged yet, 
  // but for now, active peers are in the messages keys or currently active
  if (activePeer && !rooms.includes(activePeer) && !peers.includes(activePeer)) {
    peers.push(activePeer);
  }

  const handleAddPeer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeer.trim()) return;
    const peer = newPeer.trim();
    // Initiate Key Exchange
    client.sendKeyExchange(peer).catch(console.error);
    setActivePeer(peer);
    setNewPeer('');
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Direct Messages</h2>
      
      <form onSubmit={handleAddPeer} style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <input 
          type="text" 
          placeholder="Peer Identity" 
          value={newPeer}
          onChange={(e) => setNewPeer(e.target.value)}
          style={{
            flex: 1,
            background: 'var(--color-bg-surface-elevated)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-xs)'
          }}
        />
        <button 
          type="submit"
          style={{
            background: 'var(--color-brand-primary)',
            color: 'var(--color-bg-base)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer'
          }}
        >
          Add
        </button>
      </form>

      <ul className={styles.list}>
        {peers.length === 0 ? (
          <li className={styles.emptyItem}>No direct messages</li>
        ) : (
          peers.map(peer => {
            const isOnline = Object.entries(presence).some(([key, status]) => 
              key.includes(peer) && status === 'online'
            );
            return (
              <li 
                key={peer} 
                className={`${styles.item} ${activePeer === peer ? styles.active : ''}`}
                onClick={() => setActivePeer(peer)}
              >
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isOnline ? 'var(--color-success)' : 'var(--color-border-subtle)',
                  marginRight: '8px'
                }} />
                {peer}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
