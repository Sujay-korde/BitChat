import { create } from 'zustand';
import { MessageState } from '../core/client/events';

export interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  status?: MessageState;
  isUploading?: boolean;
  uploadProgress?: number; // 0 - 100
  error?: string;
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
  deleteMessage: (target: string, msgId: string) => void;
  deleteChat: (target: string) => void;
  clearChat: (target: string) => void;
  updateMessageStatus: (msgId: string, status: MessageState) => void;
  updateMessageProgress: (msgId: string, progress: number) => void;
  updateMessage: (msgId: string, updates: Partial<Message>) => void;
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

  deleteMessage: (target, msgId) => set((state) => {
    const existing = state.messages[target];
    if (!existing) return state;

    const updated = existing.filter(m => m.id !== msgId);
    const newMessages = {
      ...state.messages,
      [target]: updated,
    };

    saveToLocalStorage(state.currentUsername, 'messages', newMessages);
    return { messages: newMessages };
  }),

  deleteChat: (target) => set((state) => {
    const newMessages = { ...state.messages };
    delete newMessages[target];

    const newRooms = state.rooms.filter(r => r !== target);

    let newActivePeer = state.activePeer;
    if (state.activePeer === target) {
      newActivePeer = newRooms[0] || Object.keys(newMessages)[0] || null;
    }

    saveToLocalStorage(state.currentUsername, 'messages', newMessages);
    saveToLocalStorage(state.currentUsername, 'rooms', newRooms);
    saveToLocalStorage(state.currentUsername, 'active_peer', newActivePeer);

    return {
      messages: newMessages,
      rooms: newRooms,
      activePeer: newActivePeer,
    };
  }),

  clearChat: (target) => set((state) => {
    const newMessages = {
      ...state.messages,
      [target]: [],
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

  updateMessageProgress: (msgId, progress) => set((state) => {
    let changed = false;
    const newMessages: Record<string, Message[]> = {};

    for (const target of Object.keys(state.messages)) {
      newMessages[target] = state.messages[target].map((msg) => {
        if (msg.id === msgId) {
          changed = true;
          return { ...msg, uploadProgress: progress, isUploading: progress < 100 };
        }
        return msg;
      });
    }

    if (!changed) return state;
    return { messages: newMessages };
  }),

  updateMessage: (msgId, updates) => set((state) => {
    let changed = false;
    const newMessages: Record<string, Message[]> = {};

    for (const target of Object.keys(state.messages)) {
      newMessages[target] = state.messages[target].map((msg) => {
        if (msg.id === msgId) {
          changed = true;
          return { ...msg, ...updates };
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
    const newPresence = { ...state.presence };

    if (status === 'offline') {
      delete newPresence[key];
      delete newPresence[user];
      for (const k of Object.keys(newPresence)) {
        if (k === user || k.endsWith(`:${user}`)) {
          delete newPresence[k];
        }
      }
    } else if (status === 'left') {
      delete newPresence[key];
      const hasOther = Object.entries(newPresence).some(
        ([k, s]) => k !== user && k.endsWith(`:${user}`) && (s === 'online' || s === 'active' || s === 'joined')
      );
      if (!hasOther && newPresence[user] === 'joined') {
        delete newPresence[user];
      }
    } else {
      newPresence[key] = status;
      newPresence[user] = status === 'joined' ? (newPresence[user] || 'online') : status;
    }

    return { presence: newPresence };
  }),

  joinRoom: (room) => set((state) => {
    const norm = room.trim().replace(/^[#@]+/, '').toLowerCase();
    const newRooms = state.rooms.includes(norm) ? state.rooms : [...state.rooms, norm];
    saveToLocalStorage(state.currentUsername, 'rooms', newRooms);
    return { rooms: newRooms };
  }),
  
  leaveRoom: (room) => set((state) => {
    const norm = room.trim().replace(/^[#@]+/, '').toLowerCase();
    const newRooms = state.rooms.filter(r => r !== norm);
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
