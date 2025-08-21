# Solver Development Guide

This guide helps you build and deploy solvers for the Intent-Based Trading Aggregator.

## Overview

Solvers are the backbone of the intent-based trading system. They compete to execute user intents by finding optimal trading routes and submitting bids to the coordinator.

## Getting Started

### Installation

```bash
npm install @intendly/solver-sdk
```

### Basic Solver Implementation

```typescript
import { SolverSDK, Intent, BidResponse } from '@intendly/solver-sdk';

const config = {
  solverPrivateKey: process.env.SOLVER_PRIVATE_KEY,
  coordinatorUrl: 'http://localhost:3001',
  wsUrl: 'ws://localhost:3002',
  chainId: 196, // X Layer
  rpcUrl: process.env.RPC_URL,
  settlementContract: process.env.SETTLEMENT_CONTRACT,
};

const sdk = new SolverSDK(config);

// Subscribe to intents
sdk.subscribeToIntents(async (intent: Intent): Promise<BidResponse | null> => {
  try {
    // 1. Get quotes from various sources
    const quotes = await getQuotes(intent);
    
    // 2. Select best quote
    const bestQuote = selectBestQuote(quotes);
    
    // 3. Calculate competitive fee
    const solverFeeBps = calculateOptimalFee(intent, bestQuote);
    
    // 4. Build router calldata
    const calldataHint = await buildRouterCalldata(intent, bestQuote);
    
    return {
      quoteOut: bestQuote.amountOut.toString(),
      solverFeeBps,
      calldataHint,
      ttlMs: 3000,
    };
  } catch (error) {
    console.error('Failed to generate bid:', error);
    return null;
  }
});
```

## Architecture

### Intent Flow
1. **Intent Received**: Your solver receives an intent via WebSocket
2. **Quote Generation**: Generate quotes from multiple DEX sources
3. **Bid Submission**: Submit competitive bid to coordinator
4. **Bid Selection**: Coordinator selects winning bid
5. **Execution**: Settlement contract executes the trade

### Key Components

#### Quote Sources
Implement different quote sources for price discovery:

```typescript
interface QuoteSource {
  name: string;
  getQuote(tokenIn: string, tokenOut: string, amountIn: bigint): Promise<Quote>;
}

class UniswapV3Source implements QuoteSource {
  async getQuote(tokenIn: string, tokenOut: string, amountIn: bigint): Promise<Quote> {
    // Implementation here
  }
}
```

#### Bidding Strategy
Develop competitive bidding strategies:

```typescript
function calculateOptimalFee(intent: Intent, quote: Quote): number {
  // Consider:
  // - Market conditions
  // - Competition level
  // - Profit margins
  // - Gas costs
  
  const baseFee = 5; // 0.05%
  const competitiveFactor = analyzeCompetition();
  return Math.min(baseFee * competitiveFactor, 30); // Max 0.30%
}
```

## Best Practices

### Performance
- **Response Time**: Aim for <2 second bid submission
- **Accuracy**: Ensure quotes are realistic and executable
- **Reliability**: Handle errors gracefully, maintain uptime

### Security
- **Private Keys**: Use secure key management
- **Input Validation**: Validate all intent parameters
- **Slippage Protection**: Account for price movements

### Economics
- **Fee Optimization**: Balance competitiveness with profitability
- **Gas Estimation**: Include gas costs in calculations
- **MEV Protection**: Implement MEV-aware strategies

## Advanced Features

### Multi-Source Aggregation
```typescript
class AdvancedSolver {
  private sources: QuoteSource[] = [
    new UniswapV3Source(),
    new SushiSwapSource(),
    new CurveSource(),
    new BalancerSource(),
  ];
  
  async getBestQuote(intent: Intent): Promise<Quote> {
    const quotes = await Promise.all(
      this.sources.map(source => 
        source.getQuote(intent.tokenIn, intent.tokenOut, BigInt(intent.amountIn))
      )
    );
    
    return quotes.reduce((best, current) => 
      current.amountOut > best.amountOut ? current : best
    );
  }
}
```

### Route Optimization
```typescript
interface Route {
  path: string[];
  pools: string[];
  expectedOutput: bigint;
  gasEstimate: bigint;
}

function optimizeRoute(routes: Route[]): Route {
  return routes.reduce((best, current) => {
    const currentNet = current.expectedOutput - current.gasEstimate * gasPrice;
    const bestNet = best.expectedOutput - best.gasEstimate * gasPrice;
    return currentNet > bestNet ? current : best;
  });
}
```

## Testing

### Local Testing
```bash
# Start local development environment
npm run dev

# Run solver tests
npm test

# Test against local coordinator
npm run test:integration
```

### Testnet Deployment
1. Deploy to X Layer testnet
2. Register solver with coordinator
3. Test with small amounts
4. Monitor performance metrics

## Monitoring

### Metrics to Track
- Bid submission rate
- Win rate percentage
- Average response time
- Profitability per trade
- Error rates

### Logging
```typescript
import { createLogger } from 'winston';

const logger = createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'solver.log' }),
    new winston.transports.Console(),
  ],
});

// Log important events
logger.info('Bid submitted', {
  intentHash,
  quoteOut,
  solverFeeBps,
  responseTime,
});
```

## Deployment

### Production Checklist
- [ ] Secure private key storage
- [ ] Error handling and recovery
- [ ] Monitoring and alerting
- [ ] Performance optimization
- [ ] Backup and redundancy

### Infrastructure
```yaml
# docker-compose.yml for solver
version: '3.8'
services:
  solver:
    build: .
    environment:
      - SOLVER_PRIVATE_KEY=${SOLVER_PRIVATE_KEY}
      - RPC_URL=${RPC_URL}
      - COORDINATOR_URL=${COORDINATOR_URL}
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Support

For solver development support:
- Check the SDK documentation
- Join the developer Discord
- Review example implementations
- Submit issues on GitHub

---

*Happy solving! 🚀*