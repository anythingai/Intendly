/**
 * @fileoverview WebSocket hooks for real-time updates
 * @description Custom hooks for managing WebSocket connections and real-time data
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { UseWebSocketReturn, UseRealtimeUpdatesReturn, MarketActivity } from '../types/hooks.js';
import { WSMessage, BestBidUpdatedMessage, BidReceivedMessage, IntentFilledMessage } from '../types/index.js';

// ============================================================================
// WebSocket Configuration
// ============================================================================

interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

const DEFAULT_CONFIG: Required<Omit<WebSocketConfig, 'url' | 'protocols'>> = {
  reconnect: true,
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000
};

// ============================================================================
// Base WebSocket Hook
// ============================================================================

export function useWebSocket(config: WebSocketConfig): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<number | null>(null);
  const [connectionTime, setConnectionTime] = useState<number | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const eventHandlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const configRef = useRef({ ...DEFAULT_CONFIG, ...config });

  // Update config when it changes
  useEffect(() => {
    configRef.current = { ...DEFAULT_CONFIG, ...config };
  }, [config]);

  // Connect function
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ws = new WebSocket(configRef.current.url, configRef.current.protocols);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionTime(Date.now());
        setReconnectAttempts(0);
        setError(null);

        // Start heartbeat
        startHeartbeat();
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        setConnectionTime(null);
        stopHeartbeat();

        if (!event.wasClean && configRef.current.reconnect && 
            reconnectAttempts < configRef.current.maxReconnectAttempts) {
          const delay = configRef.current.reconnectInterval * Math.pow(1.5, reconnectAttempts);
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        }
      };

      ws.onerror = (event) => {
        setError('WebSocket connection error');
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          
          // Handle heartbeat
          if (message.type === 'Heartbeat') {
            setLastHeartbeat(Date.now());
            return;
          }

          // Dispatch to event handlers
          const handlers = eventHandlersRef.current.get(message.type);
          if (handlers) {
            handlers.forEach(handler => {
              try {
                handler(message.data);
              } catch (error) {
                console.error('Error in event handler:', error);
              }
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

    } catch (error) {
      setError(`Failed to create WebSocket: ${error}`);
      setIsConnecting(false);
    }
  }, [reconnectAttempts]);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setConnectionTime(null);
    setReconnectAttempts(0);
  }, []);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
    }

    heartbeatTimeoutRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, configRef.current.heartbeatInterval);
  }, []);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // Send message function
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  // Subscribe to events
  const subscribe = useCallback((event: string, handler: (data: any) => void) => {
    if (!eventHandlersRef.current.has(event)) {
      eventHandlersRef.current.set(event, new Set());
    }
    eventHandlersRef.current.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = eventHandlersRef.current.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          eventHandlersRef.current.delete(event);
        }
      }
    };
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    sendMessage,
    subscribe,
    lastHeartbeat,
    connectionTime,
    reconnectAttempts
  };
}

// ============================================================================
// Real-time Updates Hook
// ============================================================================

export function useRealtimeUpdates(): UseRealtimeUpdatesReturn {
  const [liveIntents, setLiveIntents] = useState<any[]>([]);
  const [liveBids, setLiveBids] = useState<Record<string, any[]>>({});
  const [marketActivity, setMarketActivity] = useState<MarketActivity>({
    totalIntents: 0,
    activeBidding: 0,
    recentTrades: 0,
    averageSpread: 0,
    topPairs: []
  });
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  const subscribedIntentsRef = useRef<Set<string>>(new Set());

  const websocket = useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002'
  });

  // Subscribe to intent-specific events
  const subscribeToIntent = useCallback((intentHash: string) => {
    if (subscribedIntentsRef.current.has(intentHash)) {
      return;
    }

    subscribedIntentsRef.current.add(intentHash);

    // Send subscription request
    websocket.sendMessage({
      type: 'subscribe',
      data: { intentHash }
    });
  }, [websocket]);

  // Unsubscribe from intent events
  const unsubscribeFromIntent = useCallback((intentHash: string) => {
    if (!subscribedIntentsRef.current.has(intentHash)) {
      return;
    }

    subscribedIntentsRef.current.delete(intentHash);

    // Send unsubscription request
    websocket.sendMessage({
      type: 'unsubscribe',
      data: { intentHash }
    });
  }, [websocket]);

  // Handle best bid updates
  useEffect(() => {
    return websocket.subscribe('BestBidUpdated', (data: BestBidUpdatedMessage['data']) => {
      setLiveBids(prev => ({
        ...prev,
        [data.intentHash]: [data.bestBid]
      }));
      setLastUpdate(Date.now());
    });
  }, [websocket]);

  // Handle bid received events
  useEffect(() => {
    return websocket.subscribe('BidReceived', (data: BidReceivedMessage['data']) => {
      setLiveBids(prev => {
        const existingBids = prev[data.intentHash] || [];
        const newBid = {
          solver: data.solverId,
          quoteOut: data.quoteOut,
          solverFeeBps: data.solverFeeBps,
          rank: data.rank
        };
        
        return {
          ...prev,
          [data.intentHash]: [...existingBids, newBid]
        };
      });
      setLastUpdate(Date.now());
    });
  }, [websocket]);

  // Handle intent filled events
  useEffect(() => {
    return websocket.subscribe('IntentFilled', (data: IntentFilledMessage['data']) => {
      // Remove from live intents
      setLiveIntents(prev => prev.filter(intent => intent.hash !== data.intentHash));
      
      // Update market activity
      setMarketActivity(prev => ({
        ...prev,
        recentTrades: prev.recentTrades + 1
      }));
      
      setLastUpdate(Date.now());
    });
  }, [websocket]);

  // Handle intent created events
  useEffect(() => {
    return websocket.subscribe('IntentCreated', (data: any) => {
      setLiveIntents(prev => [...prev, data.intent]);
      
      setMarketActivity(prev => ({
        ...prev,
        totalIntents: prev.totalIntents + 1
      }));
      
      setLastUpdate(Date.now());
    });
  }, [websocket]);

  return {
    liveIntents,
    liveBids,
    marketActivity,
    subscribeToIntent,
    unsubscribeFromIntent,
    isConnected: websocket.isConnected,
    lastUpdate
  };
}

// ============================================================================
// Intent Bids Hook
// ============================================================================

export function useIntentBids(intentHash: string | null) {
  const [bids, setBids] = useState<any[]>([]);
  const [bestBid, setBestBid] = useState<any | null>(null);
  const [totalBids, setTotalBids] = useState(0);
  const [priceImprovement, setPriceImprovement] = useState<string | null>(null);
  const [savingsAmount, setSavingsAmount] = useState<string | null>(null);
  const [competitionLevel, setCompetitionLevel] = useState(0);
  const [biddingWindowOpen, setBiddingWindowOpen] = useState(false);
  const [windowClosesAt, setWindowClosesAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const realtimeUpdates = useRealtimeUpdates();

  // Subscribe to intent when hash changes
  useEffect(() => {
    if (intentHash) {
      realtimeUpdates.subscribeToIntent(intentHash);
      setIsLoading(true);
      
      return () => {
        realtimeUpdates.unsubscribeFromIntent(intentHash);
      };
    }
  }, [intentHash, realtimeUpdates]);

  // Update bids from real-time data
  useEffect(() => {
    if (intentHash && realtimeUpdates.liveBids[intentHash]) {
      const intentBids = realtimeUpdates.liveBids[intentHash];
      setBids(intentBids);
      setTotalBids(intentBids.length);
      
      if (intentBids.length > 0) {
        const best = intentBids.reduce((best, bid) => 
          parseFloat(bid.quoteOut) > parseFloat(best.quoteOut) ? bid : best
        );
        setBestBid(best);
        setCompetitionLevel(intentBids.length);
      }
      
      setIsLoading(false);
    }
  }, [intentHash, realtimeUpdates.liveBids]);

  // Calculate time remaining
  useEffect(() => {
    if (!windowClosesAt) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, windowClosesAt.getTime() - now) / 1000;
      setTimeRemaining(remaining);
      setBiddingWindowOpen(remaining > 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [windowClosesAt]);

  const refresh = useCallback(async () => {
    if (!intentHash) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // This would typically fetch from API
      // For now, we rely on real-time updates
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh bids');
      setIsLoading(false);
    }
  }, [intentHash]);

  return {
    bids,
    bestBid,
    totalBids,
    priceImprovement,
    savingsAmount,
    competitionLevel,
    biddingWindowOpen,
    windowClosesAt,
    timeRemaining,
    isLoading,
    error,
    refresh
  };
}

// ============================================================================
// Connection Status Hook
// ============================================================================

export function useConnectionStatus() {
  const [status, setStatus] = useState<'online' | 'offline' | 'slow'>('online');
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = () => setStatus('online');
    const handleOffline = () => setStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { status, latency };
}