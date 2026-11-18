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

  const [activeTab, setActiveTab] = useState<'all' | 'channels' | 'dms'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerType, setDrawerType] = useState<'dm' | 'group' | null>(null);
  const [inputVal, setInputVal] = useState('');

  // Collect all unique conversation IDs (rooms + DM peers)
  const conversationList: ConversationItem[] = useMemo(() => {
    const list: ConversationItem[] = [];
    const seen = new Set<string>();

    // 1. Process joined rooms (Channels)
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

    return list;
  }, [messages, rooms, activePeer, presence]);

  // Separate into channels and DMs
  const channels = useMemo(() => {
    return conversationList
      .filter(item => item.isRoom)
      .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  }, [conversationList]);

  const dms = useMemo(() => {
    return conversationList
      .filter(item => !item.isRoom)
      .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  }, [conversationList]);

  // Search filtering
  const filterItem = (item: ConversationItem) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.lastMessageText.toLowerCase().includes(q)
    );
  };

  const filteredChannels = channels.filter(filterItem);
  const filteredDms = dms.filter(filterItem);

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
    <nav className={styles.nav} aria-label="Main Discord-Style Navigation">
      {/* Brand Header */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandLogo}>#</div>
          <span className={styles.brandName}>BitChat</span>
        </div>

        <div className={styles.headerActions}>
          <button
            className={`${styles.actionButton} ${drawerType === 'dm' ? styles.actionButtonActive : ''}`}
            onClick={() => setDrawerType(drawerType === 'dm' ? null : 'dm')}
            title="Start Direct Message"
          >
            <span>+</span> Chat
          </button>
          <button
            className={`${styles.actionButton} ${drawerType === 'group' ? styles.actionButtonActive : ''}`}
            onClick={() => setDrawerType(drawerType === 'group' ? null : 'group')}
            title="Create or Join Channel"
          >
            <span>+</span> Room
          </button>
        </div>
      </header>

      {/* Action Drawer */}
      {drawerType && (
        <div className={styles.actionDrawer}>
          <div className={styles.drawerTitle}>
            {drawerType === 'dm' ? 'Start Direct Message' : 'Join or Create Channel'}
          </div>
          <form className={styles.drawerForm} onSubmit={handleDrawerSubmit}>
            <input
              type="text"
              className={styles.drawerInput}
              placeholder={drawerType === 'dm' ? 'Peer Identity (e.g. bob)' : 'Channel ID (e.g. general)'}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              autoFocus
            />
            <button type="submit" className={styles.drawerSubmit}>
              {drawerType === 'dm' ? 'Message' : 'Join'}
            </button>
          </form>
        </div>
      )}

      {/* Find/Search Bar & Filter Tabs */}
      <div className={styles.searchContainer}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Find or start a conversation"
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
            className={`${styles.filterChip} ${activeTab === 'channels' ? styles.filterChipActive : ''}`}
            onClick={() => setActiveTab('channels')}
          >
            Channels
          </button>
          <button
            className={`${styles.filterChip} ${activeTab === 'dms' ? styles.filterChipActive : ''}`}
            onClick={() => setActiveTab('dms')}
          >
            Direct Messages
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className={styles.scrollContent}>
        {/* Quick Start Search Hit */}
        {searchQuery.trim() && !exactMatchExists && (
          <div
            className={styles.startChatRow}
            onClick={() => handleStartChat(searchQuery.trim(), false)}
          >
            <span>💬</span>
            <span>Message &ldquo;<strong>{searchQuery.trim()}</strong>&rdquo;</span>
          </div>
        )}

        {/* Channels Section */}
        {(activeTab === 'all' || activeTab === 'channels') && (
          <div>
            <div className={styles.sectionHeader}>
              <span>Text Channels</span>
              <span
                className={styles.sectionAddBtn}
                onClick={() => setDrawerType('group')}
                title="Create Channel"
              >
                +
              </span>
            </div>
            <ul className={styles.chatList}>
              {filteredChannels.length === 0 ? (
                <li style={{ padding: '6px 8px', fontSize: '12px', color: '#80848e', fontStyle: 'italic' }}>
                  No channels joined yet
                </li>
              ) : (
                filteredChannels.map((item) => {
                  const isSelected = activePeer === item.id;
                  return (
                    <li
                      key={item.id}
                      className={`${styles.channelItem} ${isSelected ? styles.channelItemActive : ''}`}
                      onClick={() => setActivePeer(item.id)}
                    >
                      <span className={styles.channelHash}>#</span>
                      <span className={styles.channelName}>{item.title}</span>
                      {item.lastMessageTime > 0 && (
                        <span style={{ fontSize: '10.5px', color: '#949ba4' }}>
                          {formatRelativeTimestamp(item.lastMessageTime)}
                        </span>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}

        {/* Direct Messages Section */}
        {(activeTab === 'all' || activeTab === 'dms') && (
          <div>
            <div className={styles.sectionHeader}>
              <span>Direct Messages</span>
              <span
                className={styles.sectionAddBtn}
                onClick={() => setDrawerType('dm')}
                title="Start New Direct Chat"
              >
                +
              </span>
            </div>
            <ul className={styles.chatList}>
              {filteredDms.length === 0 ? (
                <li style={{ padding: '6px 8px', fontSize: '12px', color: '#80848e', fontStyle: 'italic' }}>
                  No direct messages yet
                </li>
              ) : (
                filteredDms.map((item) => {
                  const isSelected = activePeer === item.id;
                  const isOwn = item.lastMessageSender === username;
                  return (
                    <li
                      key={item.id}
                      className={`${styles.dmItem} ${isSelected ? styles.dmItemActive : ''}`}
                      onClick={() => setActivePeer(item.id)}
                    >
                      <div
                        className={styles.dmAvatar}
                        style={{ background: getAvatarGradient(item.title) }}
                      >
                        {item.title.substring(0, 2).toUpperCase()}
                        {item.isOnline && <span className={styles.dmPresence} />}
                      </div>

                      <div className={styles.dmDetails}>
                        <div className={styles.dmTopRow}>
                          <span className={styles.dmName}>{item.title}</span>
                          <span className={styles.dmTime}>
                            {formatRelativeTimestamp(item.lastMessageTime)}
                          </span>
                        </div>
                        <div className={styles.dmSnippet}>
                          {isOwn && <span style={{ color: '#5865f2' }}>✓ </span>}
                          <span>{item.lastMessageText || 'No messages yet'}</span>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Discord User Profile Panel (Bottom) */}
      <footer className={styles.userPanel}>
        <div className={styles.userCard}>
          <div className={styles.userAvatar}>
            {(username || 'U').substring(0, 2).toUpperCase()}
            <span className={styles.userStatusDot} />
          </div>
          <div className={styles.userNameBlock}>
            <span className={styles.userDisplayName}>{username || 'Guest'}</span>
            <span className={styles.userSubtitle}>Connected • E2EE</span>
          </div>
        </div>

        <button
          className={styles.userControlBtn}
          onClick={() => client.disconnect()}
          title="Disconnect Session"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </footer>
    </nav>
  );
}
