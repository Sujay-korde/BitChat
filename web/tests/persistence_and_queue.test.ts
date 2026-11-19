import { describe, it, expect, beforeEach } from 'vitest';
import { useConversationStore } from '../src/state/conversationStore';
import { MessageState } from '../src/core/client/events';

describe('ConversationStore & WhatsApp Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    useConversationStore.setState({
      messages: {},
      presence: {},
      rooms: [],
      activePeer: null,
      roomSequences: {},
      currentUsername: null,
    });
  });

  it('persists messages, rooms, and active peer to localStorage under username namespace', () => {
    const store = useConversationStore.getState();
    store.setCurrentUser('alice');

    store.joinRoom('dev-team');
    store.setActivePeer('bob');

    const testMsg = {
      id: 'msg-1',
      sender: 'alice',
      text: 'Hello Bob! This is persistent.',
      timestamp: Date.now(),
      status: MessageState.SENT,
    };
    store.addMessage('bob', testMsg);

    // Verify localStorage contents
    const rawMessages = localStorage.getItem('securechat_alice_messages');
    expect(rawMessages).not.toBeNull();
    const parsedMessages = JSON.parse(rawMessages!);
    expect(parsedMessages['bob']).toBeDefined();
    expect(parsedMessages['bob'][0].text).toBe('Hello Bob! This is persistent.');

    const rawRooms = localStorage.getItem('securechat_alice_rooms');
    expect(JSON.parse(rawRooms!)).toContain('dev-team');

    const rawActivePeer = localStorage.getItem('securechat_alice_active_peer');
    expect(JSON.parse(rawActivePeer!)).toBe('bob');
  });

  it('restores message history when logging in as the same user across sessions', () => {
    // Session 1: User 'alice' chats with 'charlie'
    useConversationStore.getState().setCurrentUser('alice');
    useConversationStore.getState().addMessage('charlie', {
      id: 'c-1',
      sender: 'alice',
      text: 'Hey Charlie, remember this tomorrow!',
      timestamp: 1700000000000,
    });
    useConversationStore.getState().addMessage('charlie', {
      id: 'c-2',
      sender: 'charlie',
      text: 'I will remember it.',
      timestamp: 1700000005000,
    });

    // Session 2: Tab closed, memory cleared, different user logs in
    useConversationStore.setState({
      messages: {},
      presence: {},
      rooms: [],
      activePeer: null,
      roomSequences: {},
      currentUsername: null,
    });

    // Bob logs in - should see empty messages
    useConversationStore.getState().setCurrentUser('bob');
    expect(useConversationStore.getState().messages['charlie']).toBeUndefined();

    // Alice logs back in - her full conversation history is restored!
    useConversationStore.getState().setCurrentUser('alice');
    const restoredAliceMessages = useConversationStore.getState().messages['charlie'];
    expect(restoredAliceMessages).toBeDefined();
    expect(restoredAliceMessages.length).toBe(2);
    expect(restoredAliceMessages[0].text).toBe('Hey Charlie, remember this tomorrow!');
    expect(restoredAliceMessages[1].text).toBe('I will remember it.');
  });

  it('deduplicates messages by id to prevent duplicate display', () => {
    useConversationStore.getState().setCurrentUser('alice');
    const msg = {
      id: 'dup-1',
      sender: 'alice',
      text: 'Once only',
      timestamp: Date.now(),
    };

    useConversationStore.getState().addMessage('bob', msg);
    useConversationStore.getState().addMessage('bob', msg); // same id

    expect(useConversationStore.getState().messages['bob'].length).toBe(1);
  });

  it('deletes an individual message from a conversation', () => {
    const store = useConversationStore.getState();
    store.setCurrentUser('alice');
    store.addMessage('bob', { id: 'm1', sender: 'alice', text: 'hi', timestamp: Date.now() });
    store.addMessage('bob', { id: 'm2', sender: 'bob', text: 'hey', timestamp: Date.now() });

    expect(useConversationStore.getState().messages['bob'].length).toBe(2);

    store.deleteMessage('bob', 'm1');
    expect(useConversationStore.getState().messages['bob'].length).toBe(1);
    expect(useConversationStore.getState().messages['bob'][0].id).toBe('m2');
  });

  it('deletes entire chat conversation and updates active peer', () => {
    const store = useConversationStore.getState();
    store.setCurrentUser('alice');
    store.addMessage('bob', { id: 'm1', sender: 'alice', text: 'hi', timestamp: Date.now() });
    store.addMessage('carol', { id: 'm2', sender: 'carol', text: 'hey', timestamp: Date.now() });
    store.setActivePeer('bob');

    store.deleteChat('bob');
    expect(useConversationStore.getState().messages['bob']).toBeUndefined();
    expect(useConversationStore.getState().messages['carol']).toBeDefined();
    expect(useConversationStore.getState().activePeer).toBe('carol');
  });

  it('tracks asynchronous upload progress on media messages', () => {
    const store = useConversationStore.getState();
    store.setCurrentUser('alice');
    store.addMessage('bob', {
      id: 'upload-123',
      sender: 'alice',
      text: JSON.stringify({ type: 'uploading_attachment', file_name: 'test.png', progress: 0 }),
      timestamp: Date.now(),
      isUploading: true,
      uploadProgress: 0,
    });

    store.updateMessageProgress('upload-123', 60);
    const msg = useConversationStore.getState().messages['bob'][0];
    expect(msg.uploadProgress).toBe(60);
    expect(msg.isUploading).toBe(true);

    store.updateMessageProgress('upload-123', 100);
    const msgDone = useConversationStore.getState().messages['bob'][0];
    expect(msgDone.uploadProgress).toBe(100);
    expect(msgDone.isUploading).toBe(false);
  });

  it('tracks user and room presence accurately', () => {
    const store = useConversationStore.getState();
    store.setPresence('global', 'bob', 'online');
    expect(useConversationStore.getState().presence['bob']).toBe('online');

    store.setPresence('general', 'carol', 'active');
    expect(useConversationStore.getState().presence['carol']).toBe('active');

    store.setPresence('global', 'bob', 'offline');
    expect(useConversationStore.getState().presence['bob']).toBeUndefined();
  });
});
