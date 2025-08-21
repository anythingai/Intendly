/**
 * @fileoverview Main SolverClient class - entry point for solver operations
 * @description Orchestrates all solver functionality including WebSocket connections, bid management, and quote aggregation
 */

import { EventEmitter } from 'eventemitter3';
import { IntentListener } from '../websocket/IntentListener.js';
import { BidManager } from '../bid/BidManager.js';
import { QuoteAggregator } from '../quotes/QuoteAggregator.js';
import { AuthManager } from '../auth/AuthManager.js';
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor.js';
import { BaseBidStrategy } from '../strategies/BaseBidStrategy.js';
import { AggressiveStrategy } from '../strategies/AggressiveStrategy.js';
import type {
  SolverConfig,
  Intent,
  IntentHandler,
  BidResponse,
  SolverMetrics,
  QuoteSource,
  SolverEvents
} from '../types/index.js';

export class SolverClient extends EventEmitter<SolverEvents> {
  private config: SolverConfig;
  private intentListener: IntentListener;
  private bidManager: BidManager;
  private quoteAggregator: QuoteAggregator;
  private authManager: AuthManager;
  private performanceMonitor: PerformanceMonitor;
  private bidStrategy: BaseBidStrategy;
  private isRunning = false;
  private intentHandler?: IntentHandler;

  constructor(config: SolverConfig) {
    super();
    
    this.config = {
      maxResponseTimeMs: 2000,
      maxConcurrentBids: 10,
      retryAttempts: 3,
      retryDelayMs: 500,
      enablePerformanceMonitoring: true,
      enableAutoReconnect: true,
      heartbeatIntervalMs: 30000,
      ...config
    };

    // Initialize core components
    this.authManager = new AuthManager(this.config);
    this.performanceMonitor = new PerformanceMonitor(this.config);
    this.intentListener = new IntentListener(this.config, this.authManager);
    this.bidManager = new BidManager(this.config, this.authManager);
    this.quoteAggregator = new QuoteAggregator(this.config);
    
    // Set default strategy if none provided
    this.bidStrategy = this.config.bidStrategy || new AggressiveStrategy();

    // Set up event forwarding
    this.setupEventHandlers();
  }

  /**
   * Start the solver - connects to coordinator and begins listening for intents
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Solver is already running');
    }

    try {
      this.emit('starting');
      
      // Authenticate with coordinator
      await this.authManager.authenticate();
      
      // Connect to WebSocket
      await this.intentListener.connect();
      
      // Set up intent processing
      this.intentListener.onIntent(this.processIntent.bind(this));
      
      // Start performance monitoring
      if (this.config.enablePerformanceMonitoring) {
        this.performanceMonitor.start();
      }

      this.isRunning = true;
      this.emit('started');
      
      console.log('🤖 SolverClient started successfully');
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Stop the solver - disconnects from coordinator and cleans up resources
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.emit('stopping');
      
      this.isRunning = false;
      
      // Disconnect WebSocket
      await this.intentListener.disconnect();
      
      // Stop performance monitoring
      if (this.config.enablePerformanceMonitoring) {
        this.performanceMonitor.stop();
      }

      this.emit('stopped');
      
      console.log('🛑 SolverClient stopped');
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Set custom intent handler for processing intents
   */
  onIntent(handler: IntentHandler): void {
    this.intentHandler = handler;
  }

  /**
   * Add a custom quote source to the aggregator
   */
  addQuoteSource(source: QuoteSource): void {
    this.quoteAggregator.addSource(source);
  }

  /**
   * Remove a quote source from the aggregator
   */
  removeQuoteSource(sourceName: string): void {
    this.quoteAggregator.removeSource(sourceName);
  }

  /**
   * Set the bid strategy
   */
  setBidStrategy(strategy: BaseBidStrategy): void {
    this.bidStrategy = strategy;
  }

  /**
   * Get current solver metrics
   */
  getMetrics(): SolverMetrics {
    return this.performanceMonitor.getMetrics();
  }

  /**
   * Get quote aggregator for manual quote fetching
   */
  getQuoteAggregator(): QuoteAggregator {
    return this.quoteAggregator;
  }

  /**
   * Get bid manager for manual bid submission
   */
  getBidManager(): BidManager {
    return this.bidManager;
  }

  /**
   * Process an incoming intent
   */
  private async processIntent(intent: Intent): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.emit('intentReceived', intent);
      
      // Use custom handler if provided, otherwise use default strategy
      let bidResponse: BidResponse | null = null;
      
      if (this.intentHandler) {
        bidResponse = await this.intentHandler(intent);
      } else {
        bidResponse = await this.generateDefaultBid(intent);
      }

      if (bidResponse) {
        // Submit bid
        const result = await this.bidManager.submitBid(intent, bidResponse);
        
        if (result.success) {
          this.emit('bidSubmitted', { intent, bid: bidResponse, result });
          this.performanceMonitor.recordBid(startTime, true);
        } else {
          this.emit('bidFailed', { intent, bid: bidResponse, error: result.error });
          this.performanceMonitor.recordBid(startTime, false);
        }
      } else {
        // No bid generated
        this.emit('noBid', intent);
        this.performanceMonitor.recordBid(startTime, false);
      }
    } catch (error) {
      this.emit('error', error as Error);
      this.performanceMonitor.recordBid(startTime, false);
    }
  }

  /**
   * Generate a bid using the configured strategy
   */
  private async generateDefaultBid(intent: Intent): Promise<BidResponse | null> {
    try {
      // Get quotes from all sources
      const quotes = await this.quoteAggregator.getQuotes(
        intent.tokenIn,
        intent.tokenOut,
        BigInt(intent.amountIn)
      );

      if (quotes.length === 0) {
        return null;
      }

      // Use strategy to generate bid
      return await this.bidStrategy.generateBid(intent, quotes);
    } catch (error) {
      console.error('Error generating default bid:', error);
      return null;
    }
  }

  /**
   * Set up event forwarding from sub-components
   */
  private setupEventHandlers(): void {
    // Forward WebSocket events
    this.intentListener.on('connected', () => this.emit('connected'));
    this.intentListener.on('disconnected', () => this.emit('disconnected'));
    this.intentListener.on('reconnecting', () => this.emit('reconnecting'));
    this.intentListener.on('error', (error) => this.emit('error', error));

    // Forward bid manager events
    this.bidManager.on('bidSubmitted', (data) => this.emit('bidSubmitted', data));
    this.bidManager.on('bidFailed', (data) => this.emit('bidFailed', data));
    this.bidManager.on('error', (error) => this.emit('error', error));

    // Forward quote aggregator events
    this.quoteAggregator.on('quoteFetched', (data) => this.emit('quoteFetched', data));
    this.quoteAggregator.on('quoteError', (data) => this.emit('quoteError', data));
    this.quoteAggregator.on('error', (error) => this.emit('error', error));
  }

  /**
   * Check if solver is currently running
   */
  isActive(): boolean {
    return this.isRunning && this.intentListener.isConnected();
  }

  /**
   * Get current configuration
   */
  getConfig(): SolverConfig {
    return { ...this.config };
  }
}