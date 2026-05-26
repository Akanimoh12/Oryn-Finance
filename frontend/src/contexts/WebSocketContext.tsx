import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useWallet } from './WalletContext';

interface MarketUpdate {
  marketId: string;
  timestamp: string;
  sequence: number;
  data: any;
  serverTime: number;
}

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  subscribeToMarket: (marketId: string) => void;
  unsubscribeFromMarket: (marketId: string) => void;
  subscribedMarkets: Set<string>;
  lastUpdate: MarketUpdate | null;
  connectionQuality: 'good' | 'poor' | 'disconnected';
  syncPrices: (marketIds: string[]) => Promise<any>;
  reconnectAttemptCount: number;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

const WS_URL = import.meta.env?.VITE_WS_URL || 'http://localhost:5001';
const HEARTBEAT_INTERVAL = 30000;
const SYNC_INTERVAL = 60000;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

function getExponentialDelay(attempt: number): number {
  const jitter = Math.random() * 500;
  return Math.min(BASE_RECONNECT_DELAY_MS * 2 ** attempt + jitter, MAX_RECONNECT_DELAY_MS);
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { publicKey, isConnected: walletConnected } = useWallet();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [subscribedMarkets, setSubscribedMarkets] = useState<Set<string>>(new Set());
  const [lastUpdate, setLastUpdate] = useState<MarketUpdate | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'disconnected'>('disconnected');
  const [reconnectAttemptCount, setReconnectAttemptCount] = useState(0);

  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const syncIntervalRef = useRef<NodeJS.Timeout>();
  const reconnectTimerRef = useRef<NodeJS.Timeout>();
  const lastHeartbeat = useRef<number>(0);
  const sequenceNumbers = useRef<Map<string, number>>(new Map());
  const subscribedMarketsRef = useRef<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);
  // Track listener guard to prevent duplicate registrations
  const listenersAttached = useRef(false);

  // Keep ref in sync with state so callbacks see latest subscriptions
  useEffect(() => {
    subscribedMarketsRef.current = subscribedMarkets;
  }, [subscribedMarkets]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
  }, []);

  const stopFallbackSync = useCallback(() => {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
  }, []);

  const startHeartbeat = useCallback((sock: Socket) => {
    stopHeartbeat();
    heartbeatIntervalRef.current = setInterval(() => {
      if (sock.connected) {
        sock.emit('ping', { timestamp: Date.now() });
        const timeSinceLast = Date.now() - lastHeartbeat.current;
        if (timeSinceLast > HEARTBEAT_INTERVAL * 2) {
          setConnectionQuality('poor');
        }
      }
    }, HEARTBEAT_INTERVAL);
  }, [stopHeartbeat]);

  const startFallbackSync = useCallback((sock: Socket) => {
    stopFallbackSync();
    syncIntervalRef.current = setInterval(() => {
      const markets = subscribedMarketsRef.current;
      if (markets.size > 0 && !sock.connected) {
        sock.emit('sync_prices', { marketIds: Array.from(markets) });
      }
    }, SYNC_INTERVAL);
  }, [stopFallbackSync]);

  // Restore subscriptions after reconnect (avoids duplicate emits via guard)
  const restoreSubscriptions = useCallback((sock: Socket) => {
    const markets = subscribedMarketsRef.current;
    if (markets.size > 0) {
      markets.forEach((marketId) => {
        sock.emit('subscribe_market', { marketId });
      });
    }
  }, []);

  const handleMarketUpdate = useCallback((update: MarketUpdate) => {
    const lastSeq = sequenceNumbers.current.get(update.marketId) || 0;
    if (update.sequence <= lastSeq) return;
    sequenceNumbers.current.set(update.marketId, update.sequence);
    setLastUpdate(update);
    window.dispatchEvent(new CustomEvent('marketUpdate', { detail: update }));
  }, []);

  // Attach all socket event listeners exactly once per socket instance
  const attachListeners = useCallback((sock: Socket) => {
    if (listenersAttached.current) return;
    listenersAttached.current = true;

    sock.on('connect', () => {
      setIsConnected(true);
      setConnectionQuality('good');
      reconnectAttemptsRef.current = 0;
      setReconnectAttemptCount(0);

      if (walletConnected && publicKey) {
        sock.emit('authenticate', { walletAddress: publicKey, timestamp: Date.now() });
      }

      restoreSubscriptions(sock);
      startHeartbeat(sock);
      startFallbackSync(sock);
    });

    sock.on('disconnect', (reason) => {
      setIsConnected(false);
      setConnectionQuality('disconnected');
      stopHeartbeat();
      stopFallbackSync();

      // Manual reconnect with exponential backoff for non-server-initiated disconnects
      if (reason === 'io server disconnect' || reason === 'io client disconnect') return;
      scheduleReconnect(sock);
    });

    sock.on('connect_error', () => {
      reconnectAttemptsRef.current++;
      setReconnectAttemptCount(reconnectAttemptsRef.current);
      setConnectionQuality(reconnectAttemptsRef.current > 2 ? 'poor' : 'good');

      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        scheduleReconnect(sock);
      }
    });

    sock.on('authenticated', () => {});

    sock.on('market_update', (update: MarketUpdate) => {
      handleMarketUpdate(update);
    });

    sock.on('batch_update', (batchUpdate: any) => {
      if (Array.isArray(batchUpdate.data)) {
        batchUpdate.data.forEach((update: any) => {
          handleMarketUpdate({
            marketId: batchUpdate.marketId,
            timestamp: batchUpdate.timestamp,
            sequence: batchUpdate.sequence,
            data: update,
            serverTime: batchUpdate.serverTime,
          });
        });
      }
    });

    sock.on('heartbeat', () => {
      lastHeartbeat.current = Date.now();
      setConnectionQuality('good');
    });

    sock.on('pong', (data: any) => {
      const latency = Date.now() - (data?.timestamp || Date.now());
      setConnectionQuality(latency < 1000 ? 'good' : 'poor');
      lastHeartbeat.current = Date.now();
    });

    sock.on('prices_synced', (data: any) => {
      window.dispatchEvent(new CustomEvent('pricesSynced', { detail: data }));
    });
  }, [walletConnected, publicKey, handleMarketUpdate, restoreSubscriptions, startHeartbeat, startFallbackSync, stopHeartbeat, stopFallbackSync]);

  function scheduleReconnect(sock: Socket) {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    const delay = getExponentialDelay(reconnectAttemptsRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      if (!sock.connected) sock.connect();
    }, delay);
  }

  // Build the socket once; re-build only when wallet auth changes
  useEffect(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

    const newSocket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      // Disable socket.io's built-in reconnection — we manage it ourselves
      reconnection: false,
    });

    listenersAttached.current = false;
    socketRef.current = newSocket;
    setSocket(newSocket);
    attachListeners(newSocket);

    return () => {
      listenersAttached.current = false;
      stopHeartbeat();
      stopFallbackSync();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      newSocket.removeAllListeners();
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletConnected, publicKey]);

  const subscribeToMarket = useCallback((marketId: string) => {
    const sock = socketRef.current;
    if (sock?.connected) {
      sock.emit('subscribe_market', { marketId });
    }
    setSubscribedMarkets((prev) => new Set([...prev, marketId]));
  }, []);

  const unsubscribeFromMarket = useCallback((marketId: string) => {
    const sock = socketRef.current;
    if (sock?.connected) {
      sock.emit('unsubscribe_market', { marketId });
    }
    setSubscribedMarkets((prev) => {
      const next = new Set(prev);
      next.delete(marketId);
      return next;
    });
  }, []);

  const syncPrices = useCallback(async (marketIds: string[]): Promise<any> => {
    return new Promise((resolve, reject) => {
      const sock = socketRef.current;
      if (!sock?.connected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        sock.off('prices_synced', handleSync);
        sock.off('sync_error', handleError);
        reject(new Error('Sync timeout'));
      }, 5000);

      function handleSync(data: any) {
        clearTimeout(timeout);
        sock!.off('prices_synced', handleSync);
        sock!.off('sync_error', handleError);
        resolve(data);
      }

      function handleError(error: any) {
        clearTimeout(timeout);
        sock!.off('prices_synced', handleSync);
        sock!.off('sync_error', handleError);
        reject(new Error(error?.message || 'Sync failed'));
      }

      sock.once('prices_synced', handleSync);
      sock.once('sync_error', handleError);
      sock.emit('sync_prices', { marketIds });
    });
  }, []);

  const value: WebSocketContextType = {
    socket,
    isConnected,
    subscribeToMarket,
    unsubscribeFromMarket,
    subscribedMarkets,
    lastUpdate,
    connectionQuality,
    syncPrices,
    reconnectAttemptCount,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be used within a WebSocketProvider');
  return context;
}

export function useMarketUpdates(marketId: string) {
  const { subscribeToMarket, unsubscribeFromMarket, connectionQuality, syncPrices } = useWebSocket();
  const [marketData, setMarketData] = useState<any>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);

  useEffect(() => {
    if (!marketId) return;
    subscribeToMarket(marketId);

    const handleUpdate = (event: CustomEvent) => {
      const update = event.detail as MarketUpdate;
      if (update.marketId === marketId) {
        setMarketData(update.data);
        setLastUpdateTime(update.serverTime);
      }
    };

    window.addEventListener('marketUpdate', handleUpdate as EventListener);
    return () => {
      unsubscribeFromMarket(marketId);
      window.removeEventListener('marketUpdate', handleUpdate as EventListener);
    };
  }, [marketId, subscribeToMarket, unsubscribeFromMarket]);

  useEffect(() => {
    if (connectionQuality !== 'poor' || !marketId) return;
    const interval = setInterval(async () => {
      try {
        await syncPrices([marketId]);
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [connectionQuality, marketId, syncPrices]);

  return { marketData, lastUpdateTime, connectionQuality };
}
