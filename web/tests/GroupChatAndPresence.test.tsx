import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ConversationHeader } from '../src/components/conversation/ConversationHeader';
import { MessageList } from '../src/components/conversation/MessageList';
import { useConversationStore } from '../src/state/conversationStore';
import { useConnectionStore } from '../src/state/connectionStore';

describe('Group Chat & Presence Tag UI', () => {
  beforeEach(() => {
    useConversationStore.setState({
      messages: {},
      presence: {},
      rooms: ['dev', 'general'],
      activePeer: null,
      roomSequences: {},
      currentUsername: 'alice',
    });
    useConnectionStore.setState({
      username: 'alice',
    });
  });

  it('renders explicit green active tag for group channels with active members', () => {
    useConversationStore.getState().setPresence('dev', 'bob', 'joined');
    useConversationStore.getState().setPresence('dev', 'carol', 'joined');

    render(<ConversationHeader peer="dev" />);

    expect(screen.getByText('#dev')).toBeDefined();
    expect(screen.getByText('text channel')).toBeDefined();
    // 2 members + 1 current user = 3 active
    expect(screen.getByText('3 Active')).toBeDefined();
    expect(screen.getByText(/Group Channel • 3 Online • Shared E2EE/i)).toBeDefined();
  });

  it('renders explicit Online tag for direct messages when peer is online', () => {
    useConversationStore.getState().setPresence('global', 'bob', 'online');

    render(<ConversationHeader peer="bob" />);

    expect(screen.getByText('bob')).toBeDefined();
    expect(screen.getByText('direct message')).toBeDefined();
    expect(screen.getByText('Online')).toBeDefined();
    expect(screen.getByText(/Active Now • Pairwise E2EE/i)).toBeDefined();
  });

  it('renders explicit Away tag when peer is away', () => {
    useConversationStore.getState().setPresence('global', 'bob', 'away');

    render(<ConversationHeader peer="bob" />);

    expect(screen.getByText('Away')).toBeDefined();
    expect(screen.getByText(/Away • Pairwise E2EE/i)).toBeDefined();
  });

  it('renders explicit Offline tag when peer is offline', () => {
    render(<ConversationHeader peer="charlie" />);

    expect(screen.getByText('Offline')).toBeDefined();
    expect(screen.getByText(/Offline • Pairwise E2EE/i)).toBeDefined();
  });

  it('renders grouped messages in group channel without repeating avatar or showing ticks', () => {
    const store = useConversationStore.getState();
    const now = Date.now();
    store.addMessage('dev', {
      id: 'm1',
      sender: 'bob',
      text: 'First message from Bob in #dev',
      timestamp: now,
    });
    store.addMessage('dev', {
      id: 'm2',
      sender: 'bob',
      text: 'Second consecutive message from Bob',
      timestamp: now + 5000,
    });

    const { container } = render(<MessageList activePeer="dev" />);

    expect(screen.getByText('First message from Bob in #dev')).toBeDefined();
    expect(screen.getByText('Second consecutive message from Bob')).toBeDefined();

    // Verify Bob's name only appears once as the cluster header
    const bobNames = screen.getAllByText('bob');
    expect(bobNames.length).toBe(1);

    // Verify NO ticks (✓ or ✓✓) are in the rendered text
    expect(container.textContent).not.toContain('✓');
    expect(container.textContent).not.toContain('✓✓');
  });

  it('keeps direct messages in DM section and does not add DM peers to rooms', () => {
    const store = useConversationStore.getState();
    expect(store.rooms).not.toContain('dave');

    // Simulate direct message with dave
    store.addMessage('dave', {
      id: 'dm-1',
      sender: 'alice',
      text: 'Hey Dave, private message',
      timestamp: Date.now(),
    });

    render(<ConversationHeader peer="dave" />);

    expect(screen.getByText('dave')).toBeDefined();
    expect(screen.getByText('direct message')).toBeDefined();
    expect(useConversationStore.getState().rooms).not.toContain('dave');
  });
});
