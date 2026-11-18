import { create } from 'zustand';
import { MessageState } from '../core/client/events';

export interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  status?: MessageState;
}

interface ConversationStateStore {
  messages: Record<string, Message[]>;
  presence: Record<string, string>; // room:user -> status or peer -> status
  rooms: string[];
  activePeer: string | null;
  roomSequences: Record<string, Record<string, number>>; // room -> sender -> sequence
  currentUsername: string | null;

  setCurrentUser: (username: string | null) => void;
  loadUserConversations: (username: string) => void;
  setActivePeer: (peer: string | null) => void;
  addMessage: (target: string, message: Message) => void;
  updateMessageStatus: (msgId: string, status: MessageState) => void;
  setPresence: (room: string, user: string, status: string) => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  setRoomKey: (room: string, version: number) => void;
  updateRoomSequence: (room: string, sender: string, sequence: number) => void;
}

function getStorageKey(user: string | null, key: string): string {
  return user ? `securechat_${user}_${key}` : `securechat_${key}`;
}

function saveToLocalStorage<T>(user: string | null, key: string, data: T): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(user, key), JSON.stringify(data));
  } catch (e) {
    console.warn(`Failed to save ${key} to localStorage`, e);
  }
}

function loadFromLocalStorage<T>(user: string | null, key: string, defaultValue: T): T {
  if (typeof localStorage === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(getStorageKey(user, key));
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`Failed to load ${key} from localStorage`, e);
    return defaultValue;
  }
}

export const useConversationStore = create<ConversationStateStore>((set, get) => ({
  messages: {},
  presence: {},
  rooms: [],
  activePeer: null,
  roomSequences: {},
  currentUsername: null,

  setCurrentUser: (username) => {
    set({ currentUsername: username });
    if (username) {
      get().loadUserConversations(username);
    }
  },

  loadUserConversations: (username) => {
    const savedMessages = loadFromLocalStorage<Record<string, Message[]>>(username, 'messages', {});
    const savedRooms = loadFromLocalStorage<string[]>(username, 'rooms', []);
    const savedActivePeer = loadFromLocalStorage<string | null>(username, 'active_peer', null);

    set({
      currentUsername: username,
      messages: savedMessages,
      rooms: savedRooms,
      activePeer: savedActivePeer && (savedRooms.includes(savedActivePeer) || savedMessages[savedActivePeer]) 
        ? savedActivePeer 
        : (savedRooms[0] || Object.keys(savedMessages)[0] || null),
    });
  },

  setActivePeer: (peer) => {
    set({ activePeer: peer });
    const user = get().currentUsername;
    saveToLocalStorage(user, 'active_peer', peer);
  },

  addMessage: (target, message) => set((state) => {
    const existing = state.messages[target] || [];
    // Deduplicate if message id already exists in this conversation
    if (existing.some(m => m.id === message.id)) {
      return state;
    }

    const updatedConversation = [...existing, message];
    const newMessages = {
      ...state.messages,
      [target]: updatedConversation,
    };

    saveToLocalStorage(state.currentUsername, 'messages', newMessages);

    return { messages: newMessages };
  }),

  updateMessageStatus: (msgId, status) => set((state) => {
    let changed = false;
    const newMessages: Record<string, Message[]> = {};

    for (const target of Object.keys(state.messages)) {
      newMessages[target] = state.messages[target].map((msg) => {
        if (msg.id === msgId && msg.status !== status) {
          changed = true;
          return { ...msg, status };
        }
        return msg;
      });
    }

    if (!changed) return state;

    saveToLocalStorage(state.currentUsername, 'messages', newMessages);
    return { messages: newMessages };
  }),

  setPresence: (room, user, status) => set((state) => {
    const key = `${room}:${user}`;
    if (status === 'offline' || status === 'left') {
      const newPresence = { ...state.presence };
      delete newPresence[key];
      return { presence: newPresence };
    }
    return {
      presence: {
        ...state.presence,
        [key]: status,
      }
    };
  }),

  joinRoom: (room) => set((state) => {
    const newRooms = state.rooms.includes(room) ? state.rooms : [...state.rooms, room];
    saveToLocalStorage(state.currentUsername, 'rooms', newRooms);
    return { rooms: newRooms };
  }),
  
  leaveRoom: (room) => set((state) => {
    const newRooms = state.rooms.filter(r => r !== room);
    saveToLocalStorage(state.currentUsername, 'rooms', newRooms);
    return { rooms: newRooms };
  }),

  setRoomKey: () => set(() => ({
    // For UI, we don't store raw keys in conversation store
  })),

  updateRoomSequence: (room, sender, sequence) => set((state) => ({
    roomSequences: {
      ...state.roomSequences,
      [room]: {
        ...(state.roomSequences[room] || {}),
        [sender]: Math.max(sequence, state.roomSequences[room]?.[sender] || 0)
      }
    }
  })),
}));
