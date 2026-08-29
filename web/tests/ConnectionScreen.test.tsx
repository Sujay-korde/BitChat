import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ConnectionScreen } from '../src/components/layout/ConnectionScreen';
import { useConnectionStore } from '../src/state/connectionStore';
import { ConnectionState } from '../src/core/client/events';

// Mock the Zustand store hook
vi.mock('../src/state/connectionStore', () => ({
  useConnectionStore: vi.fn(),
}));

describe('ConnectionScreen', () => {
  it('renders correctly with default state', () => {
    vi.mocked(useConnectionStore).mockReturnValue({
      state: ConnectionState.DISCONNECTED,
      error: null,
      username: null,
      setState: vi.fn(),
      setUsername: vi.fn(),
      setError: vi.fn(),
    });

    const handleConnect = vi.fn();
    render(<ConnectionScreen onConnect={handleConnect} />);

    expect(screen.getByLabelText('SERVER')).toBeDefined();
    expect(screen.getByLabelText('IDENTITY')).toBeDefined();
    expect(screen.getByRole('button', { name: /connect/i })).toBeDefined();
  });

  it('disables connect button when identity is empty', () => {
    vi.mocked(useConnectionStore).mockReturnValue({
      state: ConnectionState.DISCONNECTED,
      error: null,
      username: null,
      setState: vi.fn(),
      setUsername: vi.fn(),
      setError: vi.fn(),
    });

    const handleConnect = vi.fn();
    render(<ConnectionScreen onConnect={handleConnect} />);

    const button = screen.getByRole('button', { name: /connect/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    const identityInput = screen.getByLabelText('IDENTITY');
    fireEvent.change(identityInput, { target: { value: 'Alice' } });

    expect(button.disabled).toBe(false);
  });

  it('calls onConnect with correct values when submitted', () => {
    vi.mocked(useConnectionStore).mockReturnValue({
      state: ConnectionState.DISCONNECTED,
      error: null,
      username: null,
      setState: vi.fn(),
      setUsername: vi.fn(),
      setError: vi.fn(),
    });

    const handleConnect = vi.fn();
    render(<ConnectionScreen onConnect={handleConnect} />);

    const identityInput = screen.getByLabelText('IDENTITY');
    fireEvent.change(identityInput, { target: { value: 'Alice' } });
    
    const serverInput = screen.getByLabelText('SERVER');
    fireEvent.change(serverInput, { target: { value: 'wss://example.com' } });

    const button = screen.getByRole('button', { name: /connect/i });
    fireEvent.click(button);

    expect(handleConnect).toHaveBeenCalledWith('Alice', 'wss://example.com');
  });

  it('displays error from store', () => {
    vi.mocked(useConnectionStore).mockReturnValue({
      state: ConnectionState.DISCONNECTED,
      error: 'Authentication rejected',
      username: null,
      setState: vi.fn(),
      setUsername: vi.fn(),
      setError: vi.fn(),
    });

    render(<ConnectionScreen onConnect={vi.fn()} />);
    
    expect(screen.getByText('Connection could not be established')).toBeDefined();
    expect(screen.getByText('Authentication rejected')).toBeDefined();
  });

  it('changes button text and disables inputs during connection', () => {
    vi.mocked(useConnectionStore).mockReturnValue({
      state: ConnectionState.CONNECTING,
      error: null,
      username: 'Alice',
      setState: vi.fn(),
      setUsername: vi.fn(),
      setError: vi.fn(),
    });

    render(<ConnectionScreen onConnect={vi.fn()} />);
    
    expect(screen.getByText('Connecting...')).toBeDefined();
    expect((screen.getByLabelText('SERVER') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('IDENTITY') as HTMLInputElement).disabled).toBe(true);
  });
});
