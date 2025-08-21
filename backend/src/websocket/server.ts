/**
 * @fileoverview WebSocket server for real-time communication
 * @description Handles real-time intent/bid streaming and solver connections
 */

import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import url from 'url';
import config from '@/shared/config/index.js';
import { websocketLogger as logger, redis } from '@/utils/index.js';

export interface WSMessage {
  type: string;
  channel?: string;
  data: any;
  timestamp: number;
  id?: string;
}

export interface AuthenticatedConnection {
  ws: WebSocket;
  id: string;
  type: 'solver' | 'frontend' | 'internal';
  solverId?: string;
  authenticated: boolean;
  lastHeartbeat: number;
  subscribedChannels: Set<string>;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private server: any;
  private connections = new Map<string, AuthenticatedConnection>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    // Create HTTP server for WebSocket
    this.server = createServer();
    
    // Create WebSocket server
    this.wss = new WebSocketServer({
      server: this.server,
      path: '/stream',
      verifyClient: this.verifyClient.bind(this),
    });

    this.setupEventHandlers();
    this.startHeartbeat();
  }

  /**
   * Verify client connection
   */
  private verifyClient(info: any): boolean {
    try {
      const query = url.parse(info.req.url, true).query;
      const token = query.token as string;

      if (!token) {
        logger.warn('WebSocket connection rejected: No token provided', {
          origin: info.origin,
          userAgent: info.req.headers['user-agent']
        });
        return false;
      }

      // Verify JWT token
      jwt.verify(token, config.api.jwtSecret);
      return true;

    } catch (error) {
      logger.warn('WebSocket connection rejected: Invalid token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        origin: info.origin
      });
      return false;
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.wss.on('connection', this.handleConnection.bind(this));
    
    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { error: error.message });
    });

    // Subscribe to Redis channels for broadcasting
    this.subscribeToRedisChannels();
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(ws: WebSocket, req: any): Promise<void> {
    const connectionId = this.generateConnectionId();
    const query = url.parse(req.url, true).query;
    
    try {
      // Decode JWT to get connection info
      const token = query.token as string;
      const decoded = jwt.verify(token, config.api.jwtSecret) as any;
      
      // Create connection object
      const connection: AuthenticatedConnection = {
        ws,
        id: connectionId,
        type: decoded.type || 'frontend',
        solverId: decoded.solverId,
        authenticated: true,
        lastHeartbeat: Date.now(),
        subscribedChannels: new Set(),
      };

      this.connections.set(connectionId, connection);

      logger.websocket('connected', connectionId, {
        type: connection.type,
        solverId: connection.solverId,
        totalConnections: this.connections.size
      });

      // Setup connection event handlers
      ws.on('message', (data) => {
        this.handleMessage(connectionId, data);
      });

      ws.on('close', (code, reason) => {
        this.handleDisconnection(connectionId, code, reason);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket connection error', {
          connectionId,
          error: error.message
        });
      });

      ws.on('pong', () => {
        const conn = this.connections.get(connectionId);
        if (conn) {
          conn.lastHeartbeat = Date.now();
        }
      });

      // Send welcome message
      this.sendToConnection(connectionId, {
        type: 'Welcome',
        data: {
          connectionId,
          serverTime: Date.now(),
          config: {
            heartbeatInterval: config.websocket.heartbeatInterval,
            biddingWindowMs: config.bidding.windowMs
          }
        },
        timestamp: Date.now()
      });

      // Auto-subscribe based on connection type
      if (connection.type === 'solver') {
        await this.subscribeConnection(connectionId, 'solver:intents');
      } else if (connection.type === 'frontend') {
        await this.subscribeConnection(connectionId, 'frontend:updates');
      }

    } catch (error) {
      logger.error('Failed to handle WebSocket connection', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      ws.close(1008, 'Authentication failed');
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(connectionId: string, data: any): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      const message = JSON.parse(data.toString()) as WSMessage;
      message.timestamp = Date.now();

      logger.debug('WebSocket message received', {
        connectionId,
        type: message.type,
        channel: message.channel
      });

      switch (message.type) {
        case 'Heartbeat':
          connection.lastHeartbeat = Date.now();
          this.sendToConnection(connectionId, {
            type: 'HeartbeatAck',
            data: { serverTime: Date.now() },
            timestamp: Date.now()
          });
          break;

        case 'Subscribe':
          if (message.channel) {
            await this.subscribeConnection(connectionId, message.channel);
          }
          break;

        case 'Unsubscribe':
          if (message.channel) {
            await this.unsubscribeConnection(connectionId, message.channel);
          }
          break;

        case 'BidSubmission':
          // Forward to coordinator service
          if (connection.type === 'solver' && message.data) {
            await redis.publish('coordinator:bid_submission', {
              type: 'NewBid',
              data: message.data,
              solverId: connection.solverId,
              timestamp: Date.now()
            });
          }
          break;

        default:
          logger.warn('Unknown WebSocket message type', {
            connectionId,
            type: message.type
          });
      }

    } catch (error) {
      logger.error('Failed to handle WebSocket message', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle connection disconnection
   */
  private handleDisconnection(connectionId: string, code: number, reason: Buffer): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      logger.websocket('disconnected', connectionId, {
        type: connection.type,
        solverId: connection.solverId,
        code,
        reason: reason.toString(),
        totalConnections: this.connections.size - 1
      });

      this.connections.delete(connectionId);
    }
  }

  /**
   * Subscribe connection to a channel
   */
  private async subscribeConnection(connectionId: string, channel: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.subscribedChannels.add(channel);
    
    this.sendToConnection(connectionId, {
      type: 'Subscribed',
      data: { channel },
      timestamp: Date.now()
    });

    logger.debug('Connection subscribed to channel', {
      connectionId,
      channel,
      totalChannels: connection.subscribedChannels.size
    });
  }

  /**
   * Unsubscribe connection from a channel
   */
  private async unsubscribeConnection(connectionId: string, channel: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.subscribedChannels.delete(channel);
    
    this.sendToConnection(connectionId, {
      type: 'Unsubscribed',
      data: { channel },
      timestamp: Date.now()
    });

    logger.debug('Connection unsubscribed from channel', {
      connectionId,
      channel,
      totalChannels: connection.subscribedChannels.size
    });
  }

  /**
   * Send message to specific connection
   */
  private sendToConnection(connectionId: string, message: WSMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      connection.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to send message to connection', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.connections.delete(connectionId);
    }
  }

  /**
   * Broadcast message to channel subscribers
   */
  public broadcastToChannel(channel: string, message: WSMessage): void {
    let sentCount = 0;

    for (const [connectionId, connection] of this.connections) {
      if (connection.subscribedChannels.has(channel) && 
          connection.ws.readyState === WebSocket.OPEN) {
        
        try {
          connection.ws.send(JSON.stringify({
            ...message,
            channel,
            timestamp: Date.now()
          }));
          sentCount++;
        } catch (error) {
          logger.error('Failed to broadcast to connection', {
            connectionId,
            channel,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          this.connections.delete(connectionId);
        }
      }
    }

    logger.debug('Message broadcasted to channel', {
      channel,
      messageType: message.type,
      sentCount,
      totalConnections: this.connections.size
    });
  }

  /**
   * Subscribe to Redis channels for message distribution
   */
  private async subscribeToRedisChannels(): Promise<void> {
    try {
      // Subscribe to solver intent broadcasts
      await redis.subscribe('solver:intents', (message) => {
        this.broadcastToChannel('solver:intents', {
          type: message.data.type,
          data: message.data,
          timestamp: message.timestamp
        });
      });

      // Subscribe to frontend updates
      await redis.subscribe('websocket:bid_update', (message) => {
        this.broadcastToChannel('frontend:updates', {
          type: message.data.type,
          data: message.data,
          timestamp: message.timestamp
        });
      });

      // Subscribe to winner selections
      await redis.subscribe('coordinator:winner_selected', (message) => {
        this.broadcastToChannel('frontend:updates', {
          type: 'WinnerSelected',
          data: message.data,
          timestamp: message.timestamp
        });
      });

      logger.info('✅ Subscribed to Redis channels for WebSocket broadcasting');

    } catch (error) {
      logger.error('❌ Failed to subscribe to Redis channels', { error });
    }
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isShuttingDown) return;

      const now = Date.now();
      const disconnectedConnections: string[] = [];

      // Check for dead connections
      for (const [connectionId, connection] of this.connections) {
        const timeSinceLastHeartbeat = now - connection.lastHeartbeat;
        
        if (timeSinceLastHeartbeat > config.websocket.connectionTimeout) {
          disconnectedConnections.push(connectionId);
        } else if (connection.ws.readyState === WebSocket.OPEN) {
          // Send ping
          try {
            connection.ws.ping();
          } catch (error) {
            disconnectedConnections.push(connectionId);
          }
        }
      }

      // Remove dead connections
      for (const connectionId of disconnectedConnections) {
        const connection = this.connections.get(connectionId);
        if (connection) {
          logger.websocket('timeout', connectionId, {
            type: connection.type,
            solverId: connection.solverId
          });
          
          try {
            connection.ws.close(1001, 'Connection timeout');
          } catch (error) {
            // Ignore errors during cleanup
          }
          
          this.connections.delete(connectionId);
        }
      }

    }, config.websocket.heartbeatInterval);
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start WebSocket server
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(config.server.wsPort, config.server.host, () => {
          logger.info(`🔌 WebSocket server running on ws://${config.server.host}:${config.server.wsPort}/stream`);
          logger.info(`📊 Environment: ${config.env}`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          logger.error('WebSocket server error', { error: error.message });
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop WebSocket server
   */
  public async stop(): Promise<void> {
    this.isShuttingDown = true;

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all connections
    for (const [connectionId, connection] of this.connections) {
      try {
        connection.ws.close(1001, 'Server shutdown');
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    this.connections.clear();

    // Close WebSocket server
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          logger.info('WebSocket server stopped');
          resolve();
        });
      });
    });
  }

  /**
   * Get server statistics
   */
  public getStats(): {
    totalConnections: number;
    connectionsByType: Record<string, number>;
    totalChannels: number;
  } {
    const connectionsByType: Record<string, number> = {};
    let totalChannels = 0;

    for (const connection of this.connections.values()) {
      connectionsByType[connection.type] = (connectionsByType[connection.type] || 0) + 1;
      totalChannels += connection.subscribedChannels.size;
    }

    return {
      totalConnections: this.connections.size,
      connectionsByType,
      totalChannels
    };
  }
}

// Singleton instance
export const wsService = new WebSocketService();

export default wsService;