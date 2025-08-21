/**
 * @fileoverview Reference Solver Implementation
 * @description Complete working example of a competitive solver using the SDK
 */

import {
  SolverClient,
  AggressiveStrategy,
  OneInchSource,
  ParaSwapSource,
  UniswapV3Source,
  type SolverConfig,
  type Intent,
  type BidResponse
} from '../../src/index.js';

import { config } from './config.js';

export class ReferenceSolver {
  private client: SolverClient;
  private isRunning = false;

  constructor() {
    // Initialize solver client with configuration
    this.client = new SolverClient(config);

    // Add quote sources
    this.setupQuoteSources();

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Set up quote sources for price discovery
   */
  private setupQuoteSources(): void {
    // Add 1inch aggregator
    if (config.quoteSources?.oneInch?.enabled) {
      const oneInchSource = new OneInchSource({
        apiKey: config.quoteSources.oneInch.apiKey,
        chainId: config.chainId,
        rateLimit: { requestsPerSecond: 10, burstSize: 20 }
      });
      this.client.addQuoteSource(oneInchSource);
      console.log('✅ Added 1inch quote source');
    }

    // Add ParaSwap aggregator
    if (config.quoteSources?.paraSwap?.enabled) {
      const paraSwapSource = new ParaSwapSource({
        apiKey: config.quoteSources.paraSwap.apiKey,
        chainId: config.chainId,
        partner: 'intendly-reference-solver',
        rateLimit: { requestsPerSecond: 5, burstSize: 10 }
      });
      this.client.addQuoteSource(paraSwapSource);
      console.log('✅ Added ParaSwap quote source');
    }

    // Add Uniswap V3 direct integration
    if (config.quoteSources?.uniswapV3?.enabled) {
      const uniswapSource = new UniswapV3Source({
        rpcUrl: config.rpcUrl!,
        chainId: config.chainId,
        maxHops: 2
      });
      this.client.addQuoteSource(uniswapSource);
      console.log('✅ Added Uniswap V3 quote source');
    }
  }

  /**
   * Set up event handlers for monitoring and logging
   */
  private setupEventHandlers(): void {
    this.client.on('started', () => {
      console.log('🚀 Reference Solver started successfully');
      this.logMetrics();
    });

    this.client.on('intentReceived', (intent: Intent) => {
      console.log(`📥 Intent received: ${intent.tokenIn} -> ${intent.tokenOut}, amount: ${intent.amountIn}`);
    });

    this.client.on('bidSubmitted', ({ intent, bid, result }) => {
      console.log(`✅ Bid submitted for intent: ${intent.nonce}`);
      console.log(`   Quote: ${bid.quoteOut}, Fee: ${bid.solverFeeBps} bps, TTL: ${bid.ttlMs}ms`);
      console.log(`   Result: ${result.success ? 'SUCCESS' : 'FAILED'} ${result.bidId ? `(ID: ${result.bidId})` : ''}`);
    });

    this.client.on('bidFailed', ({ intent, bid, error }) => {
      console.error(`❌ Bid failed for intent: ${intent.nonce}`);
      console.error(`   Error: ${error}`);
    });

    this.client.on('noBid', (intent: Intent) => {
      console.log(`⏭️  No bid generated for intent: ${intent.nonce} (not profitable or no quotes)`);
    });

    this.client.on('quoteFetched', ({ source, quote }) => {
      console.log(`📊 Quote from ${source}: ${quote.amountOut.toString()}, gas: ${quote.gasEstimate.toString()}`);
    });

    this.client.on('quoteError', ({ source, error }) => {
      console.warn(`⚠️  Quote error from ${source}: ${error}`);
    });

    this.client.on('error', (error: Error) => {
      console.error(`🚨 Solver error: ${error.message}`);
    });

    this.client.on('disconnected', () => {
      console.warn('📡 WebSocket disconnected');
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Reconnecting to coordinator...');
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
      console.log('🔧 Starting Reference Solver...');
      console.log(`📡 Coordinator: ${config.coordinatorUrl}`);
      console.log(`🌐 WebSocket: ${config.wsUrl}`);
      console.log(`⛓️  Chain ID: ${config.chainId}`);
      
      await this.client.start();
      this.isRunning = true;

      // Set up periodic metrics logging
      this.startMetricsLogging();

    } catch (error) {
      console.error('Failed to start solver:', error);
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

    console.log('🛑 Stopping Reference Solver...');
    await this.client.stop();
    this.isRunning = false;
    console.log('✅ Solver stopped');
  }

  /**
   * Log current metrics
   */
  private logMetrics(): void {
    const metrics = this.client.getMetrics();
    console.log('\n📊 Current Metrics:');
    console.log(`   Total Bids: ${metrics.totalBids}`);
    console.log(`   Won Bids: ${metrics.wonBids}`);
    console.log(`   Win Rate: ${metrics.winRate.toFixed(2)}%`);
    console.log(`   Avg Response Time: ${metrics.averageResponseTime}ms`);
    console.log(`   Total Volume: ${metrics.totalVolume}`);
  }

  /**
   * Start periodic metrics logging
   */
  private startMetricsLogging(): void {
    setInterval(() => {
      if (this.isRunning) {
        this.logMetrics();
      }
    }, 60000); // Log every minute
  }

  /**
   * Get current solver status
   */
  getStatus(): {
    isRunning: boolean;
    isConnected: boolean;
    metrics: any;
    quoteSources: string[];
  } {
    return {
      isRunning: this.isRunning,
      isConnected: this.client.isActive(),
      metrics: this.client.getMetrics(),
      quoteSources: this.client.getQuoteAggregator().getSourceNames()
    };
  }
}

// Main execution
async function main() {
  const solver = new ReferenceSolver();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
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
    
    // Keep the process running
    console.log('✅ Reference Solver is running. Press Ctrl+C to stop.');
    
    // Optional: Log status every 30 seconds
    setInterval(() => {
      const status = solver.getStatus();
      console.log(`\n🔍 Status Check: Running=${status.isRunning}, Connected=${status.isConnected}, Sources=${status.quoteSources.length}`);
    }, 30000);

  } catch (error) {
    console.error('💥 Failed to start Reference Solver:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default ReferenceSolver;