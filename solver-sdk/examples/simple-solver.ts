/**
 * @fileoverview Simple Solver Example
 * @description Minimal example showing basic SDK usage
 */

import {
  SolverClient,
  AggressiveStrategy,
  type SolverConfig,
  type Intent,
  type BidResponse
} from '../src/index.js';

// Simple configuration
const config: SolverConfig = {
  solverPrivateKey: 'your-private-key-here',
  coordinatorUrl: 'http://localhost:3001',
  wsUrl: 'ws://localhost:3002',
  chainId: 196, // X Layer
  rpcUrl: 'https://rpc.xlayer.tech',
  bidStrategy: new AggressiveStrategy({
    baseFee: 10, // 0.1%
    maxFee: 50,  // 0.5%
    defaultTTL: 3000
  })
};

async function runSimpleSolver() {
  console.log('🚀 Starting Simple Solver Example...');

  // Create solver client
  const solver = new SolverClient(config);

  // Set custom intent handler
  solver.onIntent(async (intent: Intent): Promise<BidResponse | null> => {
    console.log(`📥 Processing intent: ${intent.tokenIn} -> ${intent.tokenOut}`);
    
    try {
      // Get quotes from all configured sources
      const quotes = await solver.getQuoteAggregator().getQuotes(
        intent.tokenIn,
        intent.tokenOut,
        BigInt(intent.amountIn)
      );

      if (quotes.length === 0) {
        console.log('❌ No quotes available');
        return null;
      }

      // Select best quote
      const bestQuote = quotes.reduce((best, current) => 
        current.amountOut > best.amountOut ? current : best
      );

      console.log(`💰 Best quote: ${bestQuote.amountOut.toString()} from ${bestQuote.source}`);

      // Calculate competitive fee (simple strategy)
      const solverFeeBps = 15; // 0.15%

      // Simple profitability check
      const expectedFee = (bestQuote.amountOut * BigInt(solverFeeBps)) / BigInt(10000);
      const estimatedGasCost = bestQuote.gasEstimate * BigInt(20); // 20 gwei
      
      if (expectedFee <= estimatedGasCost) {
        console.log('❌ Not profitable after gas costs');
        return null;
      }

      // Build simple calldata hint
      const calldataHint = `0x${Buffer.from(JSON.stringify({
        source: bestQuote.source,
        route: bestQuote.route
      })).toString('hex')}`;

      const bid: BidResponse = {
        quoteOut: bestQuote.amountOut.toString(),
        solverFeeBps,
        calldataHint,
        ttlMs: 3000
      };

      console.log(`✅ Generated bid: ${bid.quoteOut} with ${bid.solverFeeBps} bps fee`);
      return bid;

    } catch (error) {
      console.error('❌ Error processing intent:', error);
      return null;
    }
  });

  try {
    // Start the solver
    await solver.start();
    console.log('✅ Solver started successfully');

    // Log metrics periodically
    setInterval(() => {
      const metrics = solver.getMetrics();
      console.log('\n📊 Metrics:', {
        totalBids: metrics.totalBids,
        wonBids: metrics.wonBids,
        winRate: `${metrics.winRate.toFixed(2)}%`,
        avgResponseTime: `${metrics.averageResponseTime}ms`
      });
    }, 30000);

  } catch (error) {
    console.error('❌ Failed to start solver:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});

// Run the example
if (require.main === module) {
  runSimpleSolver().catch(console.error);
}

export default runSimpleSolver;