import { useState, useMemo } from 'react';
import styles from './NavigationPanel.module.css';
import { useConversationStore } from '../../state/conversationStore';
import { useConnectionStore } from '../../state/connectionStore';
import { client } from '../../App';
import { MessageState } from '../../core/client/events';

interface ConversationItem {
  id: string;
  isRoom: boolean;
  title: string;
  lastMessageText: string;
  lastMessageTime: number;
  lastMessageSender: string;
  lastMessageStatus?: MessageState;
  isOnline: boolean;
}

function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hues = [160, 190, 210, 270, 320, 25, 45];
  const h = hues[Math.abs(hash) % hues.length];
  return `hsl(${h}, 65%, 42%)`;
}

function formatRelativeTimestamp(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (isSameDay(d, now)) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) {
    return 'Yesterday';
  }

  return d.toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? '2-digit' : undefined,
  });
}

function parseSnippet(text?: string): string {
  if (!text) return '';
  if (text.startsWith('{"type":"attachment"')) {
    try {
      const parsed = JSON.parse(text);
      return parsed.file_name ? `📎 ${parsed.file_name}` : '📎 Attachment';
    } catch {
      return '📎 Attachment';
    }
  }
  return text;
}

export function NavigationPanel() {
  const { username } = useConnectionStore();
  const { messages, rooms, activePeer, setActivePeer, joinRoom, presence } = useConversationStore();

  const [activeTab, setActiveTab] = useState<'all' | 'chats' | 'groups'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerType, setDrawerType] = useState<'dm' | 'group' | null>(null);
  const [inputVal, setInputVal] = useState('');

  // Collect all unique conversation IDs (rooms + DM peers)
  const conversationList: ConversationItem[] = useMemo(() => {
    const list: ConversationItem[] = [];
    const seen = new Set<string>();

    // 1. Process joined rooms
    for (const room of rooms) {
      seen.add(room);
      const roomMsgs = messages[room] || [];
      const lastMsg = roomMsgs[roomMsgs.length - 1];
      list.push({
        id: room,
        isRoom: true,
        title: room,
        lastMessageText: parseSnippet(lastMsg?.text),
        lastMessageTime: lastMsg?.timestamp || 0,
        lastMessageSender: lastMsg?.sender || '',
        lastMessageStatus: lastMsg?.status,
        isOnline: false,
      });
    }

    // 2. Process all direct message peers
    for (const target of Object.keys(messages)) {
      if (seen.has(target)) continue;
      seen.add(target);
      const dmMappings = messages[target] || [];
      const lastMsg = dmMappings[dmMappings.length - 1];
      
      const isPeerOnline = Object.entries(presence).some(([key, status]) =>
        key.includes(target) && status === 'online'
      );

      list.push({
        id: target,
        isRoom: false,
        title: target,
        lastMessageText: parseSnippet(lastMsg?.text),
        lastMessageTime: lastMsg?.timestamp || 0,
        lastMessageSender: lastMsg?.sender || '',
        lastMessageStatus: lastMsg?.status,
        isOnline: isPeerOnline,
      });
    }

    // 3. If activePeer is not in the list yet, add it
    if (activePeer && !seen.has(activePeer)) {
      list.push({
        id: activePeer,
        isRoom: rooms.includes(activePeer),
        title: activePeer,
        lastMessageText: '',
        lastMessageTime: 0,
        lastMessageSender: '',
        isOnline: Object.entries(presence).some(([key, status]) =>
          key.includes(activePeer) && status === 'online'
        ),
      });
    }

    // Sort descending by most recent activity timestamp
    return list.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  }, [messages, rooms, activePeer, presence]);

  // Filtered by tab and search query
  const filteredList = useMemo(() => {
    return conversationList.filter((item) => {
      // Tab filter
      if (activeTab === 'chats' && item.isRoom) return false;
      if (activeTab === 'groups' && !item.isRoom) return false;

      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.lastMessageText.toLowerCase().includes(q)
      );
    });
  }, [conversationList, activeTab, searchQuery]);

  const handleStartChat = (targetId: string, isGroup: boolean) => {
    const trimmed = targetId.trim();
    if (!trimmed) return;

    if (isGroup) {
      client.joinRoom(trimmed).catch(console.error);
      joinRoom(trimmed);
    } else {
      client.sendKeyExchange(trimmed).catch(console.error);
    }

    setActivePeer(trimmed);
    setDrawerType(null);
    setInputVal('');
    setSearchQuery('');
  };

  const handleDrawerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleStartChat(inputVal, drawerType === 'group');
  };

  const exactMatchExists = conversationList.some(
    (c) => c.id.toLowerCase() === searchQuery.trim().toLowerCase()
  );

  return (
    <nav className={styles.nav} aria-label="Main WhatsApp Navigation">
      {/* WhatsApp Header */}
      <header className={styles.header}>
        <div className={styles.userProfile}>
          <div className={styles.avatar}>
            {(username || 'U').substring(0, 2).toUpperCase()}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{username || 'Unknown'}</span>
            <span className={styles.userStatus}>
              <span className={styles.onlineBadge} />
              online
            </span>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            className={`${styles.actionButton} ${drawerType === 'dm' ? styles.actionButtonActive : ''}`}
            onClick={() => setDrawerType(drawerType === 'dm' ? null : 'dm')}
            title="Start New Direct Chat"
          >
            <span>💬</span> New Chat
          </button>
          <button
            className={`${styles.actionButton} ${drawerType === 'group' ? styles.actionButtonActive : ''}`}
            onClick={() => setDrawerType(drawerType === 'group' ? null : 'group')}
            title="Create or Join Group"
          >
            <span>👥</span> Group
          </button>
        </div>
      </header>

      {/* Drawer for creating chat or group */}
      {drawerType && (
        <div className={styles.actionDrawer}>
          <div className={styles.drawerTitle}>
            {drawerType === 'dm' ? 'Start New Direct Chat' : 'Create or Join Room'}
          </div>
          <form className={styles.drawerForm} onSubmit={handleDrawerSubmit}>
            <input
              type="text"
              className={styles.drawerInput}
              placeholder={drawerType === 'dm' ? 'Peer Identity (e.g. bob)' : 'Room ID (e.g. dev-team)'}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              autoFocus
            />
            <button type="submit" className={styles.drawerSubmit}>
              {drawerType === 'dm' ? 'Chat' : 'Join'}
            </button>
          </form>
        </div>
      )}

      {/* Search Bar & Filter Chips */}
      <div className={styles.searchContainer}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className={styles.clearSearch}
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className={styles.filterChips}>
          <button
            className={`${styles.filterChip} ${activeTab === 'all' ? styles.filterChipActive : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All
          </button>
          <button
            className={`${styles.filterChip} ${activeTab === 'chats' ? styles.filterChipActive : ''}`}
            onClick={() => setActiveTab('chats')}
          >
            Chats
          </button>
          <button
            className={`${styles.filterChip} ${activeTab === 'groups' ? styles.filterChipActive : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            Groups
          </button>
        </div>
      </div>

      {/* Quick start row when searching for an identity not yet added */}
      {searchQuery.trim() && !exactMatchExists && (
        <div
          className={styles.startChatRow}
          onClick={() => handleStartChat(searchQuery.trim(), false)}
        >
          <span>💬</span>
          <span>Start new chat with &ldquo;<strong>{searchQuery.trim()}</strong>&rdquo;</span>
        </div>
      )}

      {/* Unified WhatsApp Chat List */}
      <ul className={styles.chatList}>
        {filteredList.length === 0 ? (
          <li className={styles.emptyState}>
            <span>No conversations found.</span>
            <button
              className={styles.actionButton}
              onClick={() => setDrawerType('dm')}
            >
              Start your first chat
            </button>
          </li>
        ) : (
          filteredList.map((item) => {
            const isSelected = activePeer === item.id;
            const isOwnLastMsg = item.lastMessageSender === username;
            const avatarBg = item.isRoom
              ? '#54656f'
              : getAvatarColor(item.title);

            return (
              <li
                key={item.id}
                className={`${styles.chatItem} ${isSelected ? styles.chatItemActive : ''}`}
                onClick={() => setActivePeer(item.id)}
              >
                <div
                  className={styles.itemAvatar}
                  style={{ backgroundColor: avatarBg }}
                >
                  {item.isRoom ? '👥' : item.title.substring(0, 2).toUpperCase()}
                  {!item.isRoom && item.isOnline && (
                    <span className={styles.itemPresence} />
                  )}
                </div>

                <div className={styles.itemDetails}>
                  <div className={styles.itemTopRow}>
                    <span className={styles.itemTitle}>
                      {item.isRoom ? `#${item.title}` : item.title}
                      {item.isRoom && <span className={styles.itemTypeTag}>group</span>}
                    </span>
                    <span className={styles.itemTime}>
                      {formatRelativeTimestamp(item.lastMessageTime)}
                    </span>
                  </div>

                  <div className={styles.itemBottomRow}>
                    <span className={styles.itemSnippet}>
                      {isOwnLastMsg && (
                        <span className={styles.sentStatus}>
                          {item.lastMessageStatus === MessageState.SENT ? '✓✓ ' : '✓ '}
                        </span>
                      )}
                      {!isOwnLastMsg && item.isRoom && item.lastMessageSender && (
                        <span><strong>{item.lastMessageSender}: </strong></span>
                      )}
                      <span>
                        {item.lastMessageText || 'Tap to message'}
                      </span>
                    </span>
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </nav>
  );
}
