import { create } from 'zustand';

interface UiStateStore {
  selectedConversation: string | null;
  setSelectedConversation: (target: string | null) => void;
}

export const useUiStore = create<UiStateStore>((set) => ({
  selectedConversation: null,
  setSelectedConversation: (target) => set({ selectedConversation: target }),
}));
