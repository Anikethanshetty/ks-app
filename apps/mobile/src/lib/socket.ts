import { useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { WS_URL } from "./config";
import { tokenStore } from "./tokens";

/**
 * Socket.IO client hook. Connects when a user is signed in, disconnects on
 * unmount or sign-out. Provides `subscribe` to listen for server events.
 *
 * Usage:
 * ```tsx
 * const { subscribe } = useSocket(!!user);
 * useEffect(() => {
 *   const unsub = subscribe("order:status_changed", (data) => { ... });
 *   return unsub;
 * }, [subscribe]);
 * ```
 */

let sharedSocket: Socket | null = null;

function getAuthToken(): string | null {
  // The access token is held in memory by tokenStore (not SecureStore, because
  // that would be synchronous). If it's not available yet, Socket.IO will fail
  // auth and the connect_error handler will attempt a refresh.
  return tokenStore.getAccess() ?? null;
}

export function useSocket(enabled: boolean) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
      }
      socketRef.current = null;
      return;
    }

    if (sharedSocket?.connected) {
      socketRef.current = sharedSocket;
      return;
    }

    const token = getAuthToken();
    if (!token) {
      // Token might not be ready yet — try again after a short delay
      const timer = setTimeout(() => {
        const retryToken = getAuthToken();
        if (retryToken) {
          sharedSocket = io(WS_URL, {
            auth: { token: retryToken },
            transports: ["websocket"],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1_000,
            reconnectionDelayMax: 10_000,
          });
          socketRef.current = sharedSocket;
        }
      }, 500);
      return () => clearTimeout(timer);
    }

    sharedSocket = io(WS_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });

    sharedSocket.on("connect_error", async (err) => {
      console.warn("[socket] connect_error:", err.message);
      // If auth failed, try refreshing the token and reconnect
      if (err.message === "TOKEN_INVALID" || err.message === "UNAUTHENTICATED") {
        try {
          const refreshed = tokenStore.getAccess();
          if (refreshed && sharedSocket) {
            sharedSocket.auth = { token: refreshed };
            sharedSocket.connect();
          }
        } catch {
          console.warn("[socket] token refresh failed");
        }
      }
    });

    socketRef.current = sharedSocket;

    return () => {
      // Don't disconnect on every re-render — let the hook manage lifecycle
    };
  }, [enabled]);

  const subscribe = useCallback(
    (event: string, handler: (...args: any[]) => void) => {
      const sock = socketRef.current ?? sharedSocket;
      if (!sock) {
        console.warn(`[socket] cannot subscribe to "${event}" — not connected`);
        return () => {};
      }
      sock.on(event, handler);
      return () => {
        sock.off(event, handler);
      };
    },
    [],
  );

  return { subscribe, socket: socketRef.current ?? sharedSocket };
}
