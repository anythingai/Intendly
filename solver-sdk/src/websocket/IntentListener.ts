/**
 * @fileoverview WebSocket connection management for receiving intents
 * @description Manages WebSocket connections, auto-reconnect, and intent processing
 */

import { EventEmitter } from 'eventemitter3';
import WebSocket from 'ws';
import type {
  Intent,
  WebSocketMessage,
  WebSocketConfig,
  AuthConfig
} from '../types/index.js';
import { AuthManager } from '../auth/AuthManager.js';

export interface IntentListenerEvents {
  connected: [];
  disconnected: [];
  reconnecting: [];
  intent: [Intent];
  error: [Error];
}

export class IntentListener extends EventEmitter<IntentListenerEvents> {
  private config: WebSocketConfig & AuthConfig;
  private authManager: AuthManager;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private intentHandler?: (intent: Intent) => Promise<void>;

  constructor(config: WebSocketConfig & AuthConfig, authManager: AuthManager) {
    super();
    
    this.config = {
      enableAutoReconnect: true,
      heartbeatIntervalMs: 30000,
      retryAttempts: 5,
      retryDelayMs: 1000,
      ...config
    };
    
    this.authManager = authManager;
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      const token = await this.authManager.getToken();
      const wsUrl = `${this.config.wsUrl}?token=${token.token}`;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', this.handleOpen.bind(this));
      this.ws.on('message', this.handleMessage.bind(this));
      this.ws.on('close', this.handleClose.bind(this));
      this.ws.on('error', this.handleError.bind(this));

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        this.ws!.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.ws!.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      throw new Error(`Failed to connect to WebSocket: ${(error as Error).message}`);
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
  }

  /**
   * Set intent handler callback
   */
  onIntent(handler: (intent: Intent) => Promise<void>): void {
    this.intentHandler = handler;
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    // Start heartbeat
    this.startHeartbeat();
    
    this.emit('connected');
    console.log('📡 WebSocket connected to coordinator');
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'IntentCreated':
          this.handleIntentCreated(message.data);
          break;
        case 'IntentExpired':
          // Handle expired intent if needed
          break;
        default:
          console.warn('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      this.emit('error', error as Error);
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(code: number, reason: Buffer): void {
    this.isConnected = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.emit('disconnected');
    console.log(`📡 WebSocket disconnected: ${code} - ${reason.toString()}`);

    // Attempt reconnection if enabled
    if (this.shouldReconnect && this.config.enableAutoReconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(error: Error): void {
    console.error('WebSocket error:', error);
    this.emit('error', error);
  }

  /**
   * Handle new intent creation
   */
  private async handleIntentCreated(intentData: Intent): void {
    try {
      // Validate intent structure
      if (!this.isValidIntent(intentData)) {
        console.error('Invalid intent received:', intentData);
        return;
      }

      this.emit('intent', intentData);

      // Call handler if provided
      if (this.intentHandler) {
        await this.intentHandler(intentData);
      }
    } catch (error) {
      console.error('Error handling intent:', error);
      this.emit('error', error as Error);
    }
  }

  /**
   * Validate intent structure
   */
  private isValidIntent(intent: any): intent is Intent {
    return (
      intent &&
      typeof intent.tokenIn === 'string' &&
      typeof intent.tokenOut === 'string' &&
      typeof intent.amountIn === 'string' &&
      typeof intent.maxSlippageBps === 'number' &&
      typeof intent.deadline === 'string' &&
      typeof intent.chainId === 'string' &&
      typeof intent.receiver === 'string' &&
      typeof intent.nonce === 'string'
    );
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    if (this.config.heartbeatIntervalMs && this.config.heartbeatIntervalMs > 0) {
      this.heartbeatInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.ping();
        }
      }, this.config.heartbeatIntervalMs);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= (this.config.retryAttempts || 5)) {
      console.error('Max reconnection attempts reached');
      this.emit('error', new Error('Max reconnection attempts exceeded'));
      return;
    }

    const delay = (this.config.retryDelayMs || 1000) * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`📡 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.emit('reconnecting');

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.scheduleReconnect();
      }
    }, delay);
  }
}