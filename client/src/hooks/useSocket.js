import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getAuth } from '../auth.js';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let token = null;
    try {
      const auth = getAuth();
      token = auth.getAccessToken();
    } catch {
      // Auth not initialized yet
    }

    const socket = io({
      transports: ['websocket'],
      auth: token ? { token } : undefined,
    });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    return () => socket.disconnect();
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  return { connected, on };
}
