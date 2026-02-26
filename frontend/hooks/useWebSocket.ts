/**
 * WebSocket Hook for Real-Time Data Updates
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';
const RECONNECT_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

interface UseWebSocketOptions {
  enabled?: boolean;
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
}

export function useWebSocket<T>(
  endpoint: string,
  options: UseWebSocketOptions = {}
) {
  const { enabled = true, onMessage, onError } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const connect = useCallback(() => {
    if (!enabled) return;

    try {
      const url = `${WS_URL}${endpoint}`;
      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log(`WebSocket connected: ${endpoint}`);
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          setData(parsedData);
          onMessage?.(parsedData);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('Connection error');
        onError?.(event);
      };

      ws.onclose = () => {
        console.log(`WebSocket disconnected: ${endpoint}`);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect
        if (
          enabled &&
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
        ) {
          reconnectAttemptsRef.current++;
          console.log(
            `Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
          );
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('Failed to reconnect after multiple attempts');
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to create connection');
    }
  }, [endpoint, enabled, onMessage, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { data, isConnected, error, reconnect: connect, disconnect };
}
