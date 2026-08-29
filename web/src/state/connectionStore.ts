import { create } from 'zustand';
import { ConnectionState } from '../core/client/events';

interface ConnectionStateStore {
  state: ConnectionState;
  username: string | null;
  error: string | null;
  setState: (state: ConnectionState) => void;
  setUsername: (username: string | null) => void;
  setError: (error: string | null) => void;
}

export const useConnectionStore = create<ConnectionStateStore>((set) => ({
  state: ConnectionState.DISCONNECTED,
  username: null,
  error: null,
  setState: (state) => set({ state }),
  setUsername: (username) => set({ username }),
  setError: (error) => set({ error }),
}));
