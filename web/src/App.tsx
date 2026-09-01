import { useEffect } from 'react';
import { ConnectionScreen } from './components/layout/ConnectionScreen';
import { AppShell } from './components/layout/AppShell';
import { useConnectionStore } from './state/connectionStore';
import { useConversationStore } from './state/conversationStore';
import { SecureChatClient } from './core/client/SecureChatClient';
import { WebSocketTransport } from './core/transport/WebSocketTransport';
import { WebCryptoProvider } from './core/crypto/WebCryptoProvider';
import { DummyModerationProvider } from './core/moderation/ModerationProvider';
import { ConnectionState } from './core/client/events';
import type { SecureChatEvent } from './core/client/events';

// Create singleton instances for the lifetime of the app
export const transport = new WebSocketTransport();
export const crypto = new WebCryptoProvider();
const moderation = new DummyModerationProvider();
export const client = new SecureChatClient(transport, crypto, moderation);

function App() {
  const { state, setState, setUsername, setError } = useConnectionStore();
  const { addMessage, updateMessageStatus, setPresence } = useConversationStore();

  useEffect(() => {
    const unsubscribe = client.onEvent((event: SecureChatEvent) => {
      switch (event.type) {
        case "ConnectionChanged":
          setState(event.state);
          break;
        case "MessageReceived": {
          const currentUsername = useConnectionStore.getState().username;
          // If we are the target (DM to us), map the conversation to the sender.
          // Otherwise (e.g. room), target remains the target.
          const conversationTarget = event.target === currentUsername ? event.sender : event.target;
          addMessage(conversationTarget, {
            id: event.msg_id || Date.now().toString(),
            sender: event.sender,
            text: event.text,
            timestamp: Date.now(),
          });
          break;
        }
        case "MessageStatusChanged":
          updateMessageStatus(event.msg_id, event.state);
          break;
        case "PresenceChanged":
          setPresence(event.room, event.user, event.status);
          break;
        case "ErrorOccurred":
          setError(event.reason);
          break;
      }
    });

    return unsubscribe;
  }, [setState, addMessage, updateMessageStatus, setPresence, setError]);

  const handleConnect = async (username: string, serverUrl: string) => {
    setUsername(username);
    setError(null);
    try {
      transport.setUri(serverUrl);
      await crypto.generateIdentity();
      await client.connect(username);
    } catch (e: any) {
      setError(`Failed to connect: ${e.message || String(e)}`);
    }
  };

  if (state !== ConnectionState.READY && state !== ConnectionState.RECONNECTING) {
    return <ConnectionScreen onConnect={handleConnect} />;
  }

  return <AppShell />;
}

export default App;
