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
  
  setActivePeer: (peer: string | null) => void;
  addMessage: (target: string, message: Message) => void;
  updateMessageStatus: (msgId: string, status: MessageState) => void;
  setPresence: (room: string, user: string, status: string) => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  setRoomKey: (room: string, version: number) => void; // only version is tracked
  updateRoomSequence: (room: string, sender: string, sequence: number) => void;
}

export const useConversationStore = create<ConversationStateStore>((set) => ({
  messages: {},
  presence: {},
  rooms: [],
  activePeer: null,
  roomSequences: {},

  setActivePeer: (peer) => set({ activePeer: peer }),

  addMessage: (target, message) => set((state) => ({
    messages: {
      ...state.messages,
      [target]: [...(state.messages[target] || []), message],
    }
  })),

  updateMessageStatus: (msgId, status) => set((state) => {
    const newMessages = { ...state.messages };
    for (const target of Object.keys(newMessages)) {
      newMessages[target] = newMessages[target].map(msg => 
        msg.id === msgId ? { ...msg, status } : msg
      );
    }
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

  joinRoom: (room) => set((state) => ({
    rooms: state.rooms.includes(room) ? state.rooms : [...state.rooms, room]
  })),
  
  leaveRoom: (room) => set((state) => ({
    rooms: state.rooms.filter(r => r !== room)
  })),

  setRoomKey: () => set(() => ({
    // For UI, we don't store the key, just trigger any re-renders if needed (e.g. to show encryption is active)
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
