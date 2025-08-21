/**
 * @fileoverview Advanced Solver Implementation
 * @description Production-ready solver with all SDK features demonstrated
 */

import {
  SolverClient,
  AggressiveStrategy,
  ConservativeStrategy,
  AdaptiveStrategy,
  OneInchSource,
  ParaSwapSource,
  UniswapV3Source,
  type SolverConfig,
  type Intent,
  type BidResponse,
  type SolverMetrics
} from '../../src/index.js';

export class AdvancedSolver {
  private client: SolverClient;
  private strategies: Map<string, any> = new Map();
  private currentStrategy = 'adaptive';
  private isRunning = false;
  private metricsInterval?: NodeJS.Timeout;

  constructor(config: SolverConfig) {
    // Initialize client with adaptive strategy by default
    this.client = new SolverClient({
      ...config,
      bidStrategy: new AdaptiveStrategy({
        baseFee: 12,
        minFee: 5,
        maxFee: 35,
        adaptationRate: 0.4
      })
    });

    // Initialize all strategies
    this.initializeStrategies();
    
    // Set up quote sources
    this.setupQuoteSources(config);
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Set up custom intent handler
    this.setupCustomIntentHandler();
  }

  /**
   * Initialize all available strategies
   */
  private initializeStrategies(): void {
    this.strategies.set('aggressive', new AggressiveStrategy({
      baseFee: 6,
      maxFee: 20,
      defaultTTL: 2000,
      minProfitThreshold: BigInt(0)
    }));

    this.strategies.set('conservative', new ConservativeStrategy({
      baseFee: 28,
      minFee: 18,
      defaultTTL: 6000,
      minProfitThreshold: BigInt('2000000000000000'), // 0.002 ETH
      profitMargin: 2.5
    }));

    this.strategies.set('adaptive', new AdaptiveStrategy({
      baseFee: 12,
      minFee: 5,
      maxFee: 35,
      adaptationRate: 0.4,
      profitTargetMultiplier: 1.8
    }));

    console.log('🎯 Initialized strategies:', Array.from(this.strategies.keys()));
  }

  /**
   * Set up quote sources based on configuration
   */
  private setupQuoteSources(config: SolverConfig): void {
    // Add 1inch if configured
    if (config.quoteSources?.oneInch?.enabled) {
      const oneInchSource = new OneInchSource({
        apiKey: config.quoteSources.oneInch.apiKey,
        chainId: config.chainId,
        rateLimit: { requestsPerSecond: 12, burstSize: 25 }
      });
      this.client.addQuoteSource(oneInchSource);
      console.log('✅ Added 1inch quote source');
    }

    // Add ParaSwap if configured
    if (config.quoteSources?.paraSwap?.enabled) {
      const paraSwapSource = new ParaSwapSource({
        apiKey: config.quoteSources.paraSwap.apiKey,
        chainId: config.chainId,
        partner: 'intendly-advanced-solver',
        rateLimit: { requestsPerSecond: 6, burstSize: 12 }
      });
      this.client.addQuoteSource(paraSwapSource);
      console.log('✅ Added ParaSwap quote source');
    }

    // Add Uniswap V3 if configured
    if (config.quoteSources?.uniswapV3?.enabled && config.rpcUrl) {
      const uniswapSource = new UniswapV3Source({
        rpcUrl: config.rpcUrl,
        chainId: config.chainId,
        maxHops: 3
      });
      this.client.addQuoteSource(uniswapSource);
      console.log('✅ Added Uniswap V3 quote source');
    }
  }

  /**
   * Set up comprehensive event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('started', () => {
      console.log('🚀 Advanced Solver started successfully');
      this.startMetricsLogging();
    });

    this.client.on('stopped', () => {
      console.log('🛑 Advanced Solver stopped');
      this.stopMetricsLogging();
    });

    this.client.on('intentReceived', (intent: Intent) => {
      console.log(`📥 Intent received: ${intent.tokenIn} -> ${intent.tokenOut}`);
      console.log(`   Amount: ${intent.amountIn}, Max Slippage: ${intent.maxSlippageBps} bps`);
      console.log(`   Deadline: ${new Date(parseInt(intent.deadline) * 1000).toISOString()}`);
    });

    this.client.on('bidSubmitted', ({ intent, bid, result }) => {
      console.log(`✅ Bid submitted successfully`);
      console.log(`   Strategy: ${this.currentStrategy}`);
      console.log(`   Quote: ${bid.quoteOut}`);
      console.log(`   Fee: ${bid.solverFeeBps} bps`);
      console.log(`   TTL: ${bid.ttlMs}ms`);
      console.log(`   Bid ID: ${result.bidId}`);
      
      // Update adaptive strategy if applicable
      if (this.currentStrategy === 'adaptive') {
        const adaptiveStrategy = this.strategies.get('adaptive') as AdaptiveStrategy;
        adaptiveStrategy.updateBidResult(bid.solverFeeBps, true);
      }
    });

    this.client.on('bidFailed', ({ intent, bid, error }) => {
      console.error(`❌ Bid failed: ${error}`);
      
      // Update adaptive strategy if applicable
      if (this.currentStrategy === 'adaptive' && bid) {
        const adaptiveStrategy = this.strategies.get('adaptive') as AdaptiveStrategy;
        adaptiveStrategy.updateBidResult(bid.solverFeeBps, false);
      }
    });

    this.client.on('noBid', (intent: Intent) => {
      console.log(`⏭️  No bid generated (not profitable or no quotes available)`);
    });

    this.client.on('quoteFetched', ({ source, quote }) => {
      console.log(`📊 Quote from ${source}: ${quote.amountOut.toString()}`);
    });

    this.client.on('quoteError', ({ source, error }) => {
      console.warn(`⚠️  Quote error from ${source}: ${error}`);
    });

    this.client.on('error', (error: Error) => {
      console.error(`🚨 Solver error: ${error.message}`);
      
      // Implement error recovery logic
      if (error.message.includes('Rate limit')) {
        console.log('🔄 Implementing rate limit backoff...');
        // Could implement exponential backoff here
      }
    });

    this.client.on('disconnected', () => {
      console.warn('📡 WebSocket disconnected');
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Reconnecting to coordinator...');
    });
  }

  /**
   * Set up custom intent handler with advanced logic
   */
  private setupCustomIntentHandler(): void {
    this.client.onIntent(async (intent: Intent): Promise<BidResponse | null> => {
      const startTime = Date.now();
      
      try {
        // Get quotes with timeout
        const quotes = await this.client.getQuoteAggregator().getQuotesWithTimeout(
          intent.tokenIn,
          intent.tokenOut,
          BigInt(intent.amountIn),
          3000 // 3 second timeout
        );

        if (quotes.length === 0) {
          console.log('❌ No quotes available for intent');
          return null;
        }

        // Log quote analysis
        const quoteStats = this.client.getQuoteAggregator().getQuoteStats(quotes);
        console.log(`📈 Quote analysis: ${quoteStats.count} quotes from [${quoteStats.sources.join(', ')}]`);
        console.log(`   Best: ${quoteStats.bestOutput.toString()}, Worst: ${quoteStats.worstOutput.toString()}`);

        // Select and apply current strategy
        const strategy = this.strategies.get(this.currentStrategy);
        const bid = await strategy.generateBid(intent, quotes);

        if (bid) {
          const responseTime = Date.now() - startTime;
          console.log(`⚡ Generated bid in ${responseTime}ms using ${this.currentStrategy} strategy`);
        }

        return bid;

      } catch (error) {
        console.error('❌ Error in custom intent handler:', error);
        return null;
      }
    });
  }

  /**
   * Start the solver
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Solver is already running');
      return;
    }

    try {
      console.log('🔧 Starting Advanced Solver...');
      console.log(`📡 Coordinator: ${this.client.getConfig().coordinatorUrl}`);
      console.log(`🌐 WebSocket: ${this.client.getConfig().wsUrl}`);
      console.log(`⛓️  Chain ID: ${this.client.getConfig().chainId}`);
      console.log(`🎯 Strategy: ${this.currentStrategy}`);
      console.log(`📊 Quote Sources: ${this.client.getQuoteAggregator().getSourceNames().join(', ')}`);

      await this.client.start();
      this.isRunning = true;

    } catch (error) {
      console.error('Failed to start Advanced Solver:', error);
      throw error;
    }
  }

  /**
   * Stop the solver
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping Advanced Solver...');
    await this.client.stop();
    this.isRunning = false;
    console.log('✅ Advanced Solver stopped');
  }

  /**
   * Switch to a different strategy
   */
  switchStrategy(strategyName: string): void {
    if (!this.strategies.has(strategyName)) {
      throw new Error(`Unknown strategy: ${strategyName}`);
    }

    this.currentStrategy = strategyName;
    const strategy = this.strategies.get(strategyName);
    this.client.setBidStrategy(strategy);
    
    console.log(`🎯 Switched to ${strategyName} strategy`);
  }

  /**
   * Get comprehensive solver status
   */
  getStatus(): {
    isRunning: boolean;
    isConnected: boolean;
    currentStrategy: string;
    metrics: SolverMetrics;
    quoteSources: string[];
    strategies: string[];
  } {
    return {
      isRunning: this.isRunning,
      isConnected: this.client.isActive(),
      currentStrategy: this.currentStrategy,
      metrics: this.client.getMetrics(),
      quoteSources: this.client.getQuoteAggregator().getSourceNames(),
      strategies: Array.from(this.strategies.keys())
    };
  }

  /**
   * Start comprehensive metrics logging
   */
  private startMetricsLogging(): void {
    this.metricsInterval = setInterval(() => {
      if (!this.isRunning) return;

      const metrics = this.client.getMetrics();
      const status = this.getStatus();
      
      console.log('\n📊 Advanced Solver Metrics:');
      console.log(`   Status: ${status.isConnected ? '🟢 Connected' : '🔴 Disconnected'}`);
      console.log(`   Strategy: ${this.currentStrategy}`);
      console.log(`   Total Bids: ${metrics.totalBids}`);
      console.log(`   Won Bids: ${metrics.wonBids}`);
      console.log(`   Win Rate: ${metrics.winRate.toFixed(2)}%`);
      console.log(`   Avg Response: ${metrics.averageResponseTime}ms`);
      console.log(`   Total Volume: ${metrics.totalVolume}`);
      console.log(`   Quote Sources: ${status.quoteSources.length}`);

      // Log adaptive strategy metrics if active
      if (this.currentStrategy === 'adaptive') {
        const adaptiveStrategy = this.strategies.get('adaptive') as AdaptiveStrategy;
        const adaptationMetrics = adaptiveStrategy.getAdaptationMetrics();
        console.log(`   Recent Win Rate: ${(adaptationMetrics.recentWinRate * 100).toFixed(2)}%`);
        console.log(`   Avg Fee: ${adaptationMetrics.averageFee.toFixed(2)} bps`);
      }

      console.log('');
    }, 60000); // Log every minute
  }

  /**
   * Stop metrics logging
   */
  private stopMetricsLogging(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): string {
    const performanceMonitor = this.client.getPerformanceMonitor();
    return performanceMonitor.exportMetrics();
  }
}

// Example configuration
const config: SolverConfig = {
  solverPrivateKey: process.env.SOLVER_PRIVATE_KEY || 'your-private-key',
  coordinatorUrl: process.env.COORDINATOR_URL || 'http://localhost:3001',
  wsUrl: process.env.WS_URL || 'ws://localhost:3002',
  chainId: parseInt(process.env.CHAIN_ID || '196'),
  rpcUrl: process.env.RPC_URL,
  settlementContract: process.env.SETTLEMENT_CONTRACT,
  
  // Performance settings
  maxResponseTimeMs: 2500,
  maxConcurrentBids: 15,
  retryAttempts: 4,
  retryDelayMs: 300,
  enablePerformanceMonitoring: true,
  enableAutoReconnect: true,
  heartbeatIntervalMs: 25000,

  // Quote sources
  quoteSources: {
    oneInch: {
      enabled: process.env.ONEINCH_ENABLED !== 'false',
      apiKey: process.env.ONEINCH_API_KEY
    },
    paraSwap: {
      enabled: process.env.PARASWAP_ENABLED !== 'false',
      apiKey: process.env.PARASWAP_API_KEY
    },
    uniswapV3: {
      enabled: process.env.UNISWAP_V3_ENABLED !== 'false'
    }
  }
};

// Main execution
async function main() {
  const solver = new AdvancedSolver(config);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    console.log('📄 Final Performance Report:');
    console.log(solver.getPerformanceReport());
    await solver.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await solver.stop();
    process.exit(0);
  });

  try {
    await solver.start();
    
    console.log('✅ Advanced Solver is running. Press Ctrl+C to stop.');
    console.log('🎯 Available commands:');
    console.log('   - Switch strategy: solver.switchStrategy("aggressive|conservative|adaptive")');
    console.log('   - Get status: solver.getStatus()');
    console.log('   - Get performance: solver.getPerformanceReport()');

    // Example of dynamic strategy switching (comment out for production)
    // setTimeout(() => {
    //   console.log('🔄 Switching to aggressive strategy for demonstration...');
    //   solver.switchStrategy('aggressive');
    // }, 30000);

  } catch (error) {
    console.error('💥 Failed to start Advanced Solver:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default AdvancedSolver;