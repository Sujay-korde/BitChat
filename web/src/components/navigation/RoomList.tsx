import { useState } from 'react';
import styles from './List.module.css';
import { useConversationStore } from '../../state/conversationStore';
import { client } from '../../App';

export function RoomList() {
  const { rooms, activePeer, setActivePeer, joinRoom } = useConversationStore();
  const [newRoom, setNewRoom] = useState('');

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoom.trim()) return;
    const room = newRoom.trim();
    
    // Join via client
    client.joinRoom(room).catch(console.error);
    joinRoom(room);
    setActivePeer(room);
    setNewRoom('');
  };

  const distributeKey = (room: string) => {
    // In a real app we'd track members, here we just ask the client to generate
    // and we'll manually distribute to some mocked peers or known peers for testing.
    // For manual test, we'll just distribute to all known DMs (not rooms).
    const state = useConversationStore.getState();
    const peers = Object.keys(state.messages).filter(t => !state.rooms.includes(t));
    
    // Distribute to all peers we know
    client.generateAndDistributeRoomKey(room, peers).then(() => {
      alert(`Distributed new room key vX to ${peers.length} peers`);
    }).catch(e => {
      alert(`Failed to distribute key: ${e.message}`);
    });
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Rooms</h2>
      
      <form onSubmit={handleAddRoom} style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <input 
          type="text" 
          placeholder="Room ID" 
          value={newRoom}
          onChange={(e) => setNewRoom(e.target.value)}
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
          Join
        </button>
      </form>

      <ul className={styles.list}>
        {rooms.length === 0 ? (
          <li className={styles.emptyItem}>No rooms</li>
        ) : (
          rooms.map(room => (
            <li 
              key={room} 
              className={`${styles.item} ${activePeer === room ? styles.active : ''}`}
              onClick={() => setActivePeer(room)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>{room}</span>
              {activePeer === room && (
                <button 
                  onClick={(e) => { e.stopPropagation(); distributeKey(room); }}
                  style={{
                    background: 'var(--color-bg-surface-elevated)',
                    border: '1px solid var(--color-border-subtle)',
                    color: 'var(--color-text-primary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '10px',
                    padding: '2px 4px',
                    cursor: 'pointer'
                  }}
                  title="Generate & Distribute New Room Key to all DMs"
                >
                  Gen Key
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
