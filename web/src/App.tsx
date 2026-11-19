import { useEffect } from 'react';
import { ConnectionScreen } from './components/layout/ConnectionScreen';
import { AppShell } from './components/layout/AppShell';
import { useConnectionStore } from './state/connectionStore';
import { useConversationStore } from './state/conversationStore';
import { SecureChatClient } from './core/client/SecureChatClient';
import { WebSocketTransport } from './core/transport/WebSocketTransport';
import { WebCryptoProvider } from './core/crypto/WebCryptoProvider';
import { DummyModerationProvider } from './core/moderation/ModerationProvider';
import { ConnectionState, MessageState } from './core/client/events';
import type { SecureChatEvent } from './core/client/events';

// Create singleton instances for the lifetime of the app
export const transport = new WebSocketTransport();
export const crypto = new WebCryptoProvider();
const moderation = new DummyModerationProvider();
export const client = new SecureChatClient(transport, crypto, moderation);

function App() {
  const { state, setState, setUsername, setError } = useConnectionStore();
  const { addMessage, updateMessageStatus, setPresence, setCurrentUser } = useConversationStore();

  useEffect(() => {
    const unsubscribe = client.onEvent((event: SecureChatEvent) => {
      switch (event.type) {
        case "ConnectionChanged":
          setState(event.state);
          if (event.state === ConnectionState.READY) {
            const currentUsername = useConnectionStore.getState().username;
            if (currentUsername) {
              setCurrentUser(currentUsername);
            }
            // Auto sync joined rooms with socket server
            const savedRooms = useConversationStore.getState().rooms;
            if (savedRooms && savedRooms.length > 0) {
              client.syncRooms(savedRooms);
            }
            // Query online peers immediately
            client.queryPresence().catch(console.error);
          }
          break;
        case "MessageReceived": {
          const currentUsername = useConnectionStore.getState().username;
          const isRoom = Boolean(event.isRoom);
          
          let conversationTarget: string;
          if (isRoom) {
            conversationTarget = event.target.trim().replace(/^[#@]+/, '').toLowerCase();
            // It is an explicit room message! Auto-join if not already joined
            useConversationStore.getState().joinRoom(conversationTarget);
          } else {
            // Direct message: if we sent it, target is the peer; if we received it, target is the sender
            const peer = event.sender === currentUsername ? event.target : event.sender;
            conversationTarget = peer.trim().replace(/^[#@]+/, '').toLowerCase();
            // Direct messages must NEVER be in rooms! Clean up if contaminated earlier:
            if (useConversationStore.getState().rooms.includes(conversationTarget)) {
              useConversationStore.getState().leaveRoom(conversationTarget);
            }
          }

          addMessage(conversationTarget, {
            id: event.msg_id || Date.now().toString(),
            sender: event.sender,
            text: event.text,
            timestamp: Date.now(),
            status: event.sender === currentUsername ? MessageState.PENDING : undefined,
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
        case "EncryptionUnavailable":
          setError("Message encryption unavailable: cryptographic key exchange pending or not established yet.");
          break;
        case "ModerationRejected":
          setError(`Message blocked: content did not pass local moderation filter.`);
          break;
      }
    });

    return unsubscribe;
  }, [setState, addMessage, updateMessageStatus, setPresence, setError, setCurrentUser]);

  // Accurately verify when the user is actively using / has opened the chat application
  useEffect(() => {
    if (state !== ConnectionState.READY) return;

    let blurTimer: any = null;

    const handleFocus = () => {
      if (blurTimer) clearTimeout(blurTimer);
      client.sendPresence("active").catch(console.error);
    };

    const handleBlur = () => {
      // Small debounce: only mark away if blurred for more than 15s
      blurTimer = setTimeout(() => {
        client.sendPresence("away").catch(console.error);
      }, 15000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (blurTimer) clearTimeout(blurTimer);
        client.sendPresence("active").catch(console.error);
      } else {
        client.sendPresence("away").catch(console.error);
      }
    };

    const handleBeforeUnload = () => {
      client.sendPresence("offline").catch(console.error);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Initial presence announce
    client.sendPresence("active").catch(console.error);
    client.queryPresence().catch(console.error);

    // Periodic sync of online users
    const queryInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        client.queryPresence().catch(console.error);
      }
    }, 20000);

    return () => {
      if (blurTimer) clearTimeout(blurTimer);
      clearInterval(queryInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state]);

  const handleConnect = async (username: string, serverUrl: string) => {
    setUsername(username);
    setCurrentUser(username);
    setError(null);
    try {
      transport.setUri(serverUrl);
      await crypto.generateIdentity(username);
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
