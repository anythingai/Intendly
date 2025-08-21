# Intent-Based Trading Aggregator - Developer Guide

Complete guide for developers who want to contribute to, integrate with, or understand the Intent-Based Trading Aggregator system.

## Table of Contents

- [Getting Started](#getting-started)
- [Local Development Setup](#local-development-setup)
- [Architecture Overview](#architecture-overview)
- [Contributing](#contributing)
- [Testing](#testing)
- [Deployment](#deployment)
- [SDK Development](#sdk-development)
- [Smart Contract Development](#smart-contract-development)
- [Frontend Development](#frontend-development)
- [Backend Development](#backend-development)
- [Solver Development](#solver-development)

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 18 or higher
- **npm**: Version 9 or higher  
- **Git**: Latest version
- **Docker**: For containerized development
- **Foundry**: For smart contract development

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/intendly/intent-based-trading-aggregator.git
cd intent-based-trading-aggregator

# Install dependencies for all workspaces
npm install

# Copy environment configuration
cp .env.example .env

# Start development environment
npm run dev
```

## Local Development Setup

### Environment Configuration

1. **Copy Environment Variables**
   ```bash
   cp .env.example .env
   ```

2. **Configure Database**
   ```bash
   # Start PostgreSQL with Docker
   docker run -d \
     --name intendly-postgres \
     -e POSTGRES_DB=intendly \
     -e POSTGRES_USER=intendly \
     -e POSTGRES_PASSWORD=dev_password \
     -p 5432:5432 \
     postgres:14-alpine
   ```

3. **Configure Redis**
   ```bash
   # Start Redis with Docker
   docker run -d \
     --name intendly-redis \
     -p 6379:6379 \
     redis:7-alpine
   ```

4. **Update .env File**
   ```env
   DATABASE_URL=postgresql://intendly:dev_password@localhost:5432/intendly
   REDIS_URL=redis://localhost:6379
   CHAIN_ID=195  # X Layer Testnet
   RPC_URL=https://testrpc.xlayer.tech
   ```

### Development Services

Start all services in development mode:

```bash
# Start all services
npm run dev

# Or start individual services
npm run dev:contracts    # Smart contracts (Foundry)
npm run dev:backend     # Backend services
npm run dev:web         # Frontend application
npm run dev:solver      # Example solver
```

### Using Docker Compose

For a complete development environment:

```bash
# Start all services with Docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Architecture Overview

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend dApp │    │  Backend APIs   │    │ Smart Contracts │
│                 │    │                 │    │                 │
│  • Next.js 14   │◄──►│  • Relayer      │◄──►│  • Settlement   │
│  • Wagmi/Viem   │    │  • Coordinator  │    │  • Permit2      │
│  • Tailwind CSS │    │  • WebSocket    │    │  • Router       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   Solver SDK    │              │
         └──────────────►│                 │◄─────────────┘
                        │  • TypeScript   │
                        │  • Quote Agg.   │
                        │  • Bid Logic    │
                        └─────────────────┘
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Smart Contracts** | Solidity 0.8.19, Foundry | On-chain settlement |
| **Backend** | Node.js, Express, TypeScript | API services |
| **Frontend** | Next.js 14, React, Tailwind | User interface |
| **Database** | PostgreSQL | Data persistence |
| **Cache** | Redis | Real-time data |
| **Solver SDK** | TypeScript | Solver development |
| **Testing** | Jest, Playwright, Foundry | Quality assurance |
| **Deployment** | Docker, Kubernetes, Terraform | Infrastructure |

### Data Flow

1. **Intent Creation**
   ```
   User → Frontend → EIP-712 Signature → Backend → Broadcast
   ```

2. **Solver Competition**
   ```
   Solvers → Quote Calculation → Bid Submission → Selection
   ```

3. **Settlement**
   ```
   Winner → Route Execution → Smart Contract → Token Transfer
   ```

## Contributing

### Development Workflow

1. **Fork the Repository**
   ```bash
   git clone https://github.com/yourusername/intent-based-trading-aggregator.git
   cd intent-based-trading-aggregator
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make Changes**
   - Follow coding standards
   - Add tests for new functionality
   - Update documentation

4. **Run Tests**
   ```bash
   npm test
   npm run test:integration
   npm run test:e2e
   ```

5. **Commit Changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```

6. **Push and Create PR**
   ```bash
   git push origin feature/amazing-feature
   ```

### Coding Standards

#### TypeScript/JavaScript

```typescript
// Use meaningful names
const calculateOptimalRoute = (
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): Route => {
  // Implementation
};

// Document complex functions
/**
 * Calculates the optimal route for a token swap
 * @param tokenIn - Input token address
 * @param tokenOut - Output token address  
 * @param amountIn - Input amount in wei
 * @returns Optimal route with pools and fees
 */
```

#### Solidity

```solidity
// Use NatSpec documentation
/**
 * @notice Settles an intent with the winning bid
 * @param intent The intent to settle
 * @param signature User's EIP-712 signature
 * @param bid The winning solver bid
 */
function settleIntent(
    Intent calldata intent,
    bytes calldata signature,
    Bid calldata bid
) external nonReentrant {
    // Implementation
}
```

### Code Review Process

1. **Automated Checks**
   - Linting with ESLint
   - Type checking with TypeScript
   - Security scanning with Slither
   - Test coverage requirements

2. **Manual Review**
   - Code quality and readability
   - Architecture adherence
   - Security considerations
   - Performance implications

3. **Testing Requirements**
   - Unit tests for all new code
   - Integration tests for API changes
   - End-to-end tests for user flows
   - Gas optimization for contracts

## Testing

### Test Structure

```
tests/
├── unit/              # Unit tests
│   ├── backend/       # Backend unit tests
│   ├── frontend/      # Frontend unit tests
│   └── contracts/     # Contract unit tests
├── integration/       # Integration tests
│   ├── api/          # API integration tests
│   └── contracts/    # Contract integration tests
├── e2e/              # End-to-end tests
│   └── playwright/   # Playwright tests
└── performance/      # Performance tests
```

### Running Tests

```bash
# All tests
npm test

# Specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:contracts

# With coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Writing Tests

#### Unit Tests

```typescript
import { describe, it, expect } from '@jest/globals';
import { IntentService } from '../src/services/IntentService';

describe('IntentService', () => {
  it('should validate intent parameters', async () => {
    const service = new IntentService();
    const intent = {
      tokenIn: '0x...',
      tokenOut: '0x...',
      amountIn: '1000000000000000000'
    };
    
    const result = await service.validateIntent(intent);
    expect(result.isValid).toBe(true);
  });
});
```

#### Contract Tests

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/IntentSettlement.sol";

contract IntentSettlementTest is Test {
    IntentSettlement settlement;
    
    function setUp() public {
        settlement = new IntentSettlement(
            address(permit2),
            address(router),
            address(treasury),
            address(this)
        );
    }
    
    function testSettleIntent() public {
        // Test implementation
    }
}
```

#### End-to-End Tests

```typescript
import { test, expect } from '@playwright/test';

test('complete intent flow', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Connect wallet
  await page.click('[data-testid="connect-wallet"]');
  
  // Create intent
  await page.fill('[data-testid="amount-input"]', '100');
  await page.click('[data-testid="create-intent"]');
  
  // Wait for settlement
  await expect(page.locator('[data-testid="intent-status"]'))
    .toHaveText('Settled', { timeout: 60000 });
});
```

## Deployment

### Environment Setup

#### Development
```bash
# Start development environment
npm run dev

# Or with Docker
docker-compose up -d
```

#### Staging
```bash
# Deploy to staging
./deployment/scripts/deploy.sh staging

# Run health checks
./deployment/scripts/health-check.sh staging
```

#### Production
```bash
# Deploy infrastructure
cd deployment/terraform/aws
terraform apply

# Deploy application
./deployment/scripts/deploy.sh production

# Validate deployment
./deployment/scripts/health-check.sh production
```

### CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment:

1. **Pull Request Checks**
   - Code linting and formatting
   - Type checking
   - Unit and integration tests
   - Security scanning

2. **Staging Deployment**
   - Automatic deployment on main branch
   - Smoke tests and health checks
   - Performance validation

3. **Production Deployment**
   - Manual approval required
   - Blue-green deployment strategy
   - Comprehensive health checks
   - Automatic rollback on failure

## SDK Development

### Solver SDK

The Solver SDK provides tools for building competitive solvers:

```typescript
import { SolverSDK } from '@intendly/solver-sdk';

const solver = new SolverSDK({
  privateKey: process.env.SOLVER_PRIVATE_KEY,
  rpcUrl: process.env.RPC_URL,
  apiUrl: process.env.API_URL
});

// Register solver
await solver.register({
  name: 'My Solver',
  description: 'High-performance solver'
});

// Listen for intents
solver.onIntent(async (intent) => {
  const quote = await calculateQuote(intent);
  await solver.submitBid(intent.id, quote);
});
```

### Creating Custom Strategies

```typescript
import { BaseBidStrategy } from '@intendly/solver-sdk';

export class CustomStrategy extends BaseBidStrategy {
  async calculateBid(intent: Intent): Promise<Bid> {
    // Custom bid calculation logic
    const routes = await this.findOptimalRoutes(intent);
    const bestRoute = this.selectBestRoute(routes);
    
    return {
      quoteOut: bestRoute.amountOut,
      solverFee: this.calculateFee(bestRoute),
      calldata: bestRoute.calldata
    };
  }
}
```

## Smart Contract Development

### Contract Structure

```
contracts/
├── src/
│   ├── IntentSettlement.sol    # Main settlement contract
│   ├── interfaces/             # Contract interfaces
│   ├── libraries/              # Shared libraries
│   └── mocks/                  # Test mocks
├── test/                       # Contract tests
├── script/                     # Deployment scripts
└── foundry.toml               # Foundry configuration
```

### Development Workflow

1. **Write Contracts**
   ```bash
   # Create new contract
   touch contracts/src/NewContract.sol
   ```

2. **Compile**
   ```bash
   cd contracts
   forge build
   ```

3. **Test**
   ```bash
   forge test -vv
   ```

4. **Deploy Locally**
   ```bash
   forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
   ```

### Gas Optimization

```solidity
// Use packed structs
struct Intent {
    address tokenIn;      // 20 bytes
    address tokenOut;     // 20 bytes
    uint96 amountIn;      // 12 bytes (saves 1 slot)
    uint96 minAmountOut;  // 12 bytes
    uint32 deadline;      // 4 bytes
    uint16 slippageBps;   // 2 bytes
}

// Use events for off-chain indexing
event IntentCreated(
    bytes32 indexed intentHash,
    address indexed user,
    address tokenIn,
    address tokenOut,
    uint256 amountIn
);
```

## Frontend Development

### Project Structure

```
web/
├── app/                  # Next.js 14 app directory
├── components/           # React components
├── hooks/               # Custom React hooks
├── lib/                 # Utilities and configurations
├── public/              # Static assets
├── styles/              # CSS and Tailwind styles
└── types/               # TypeScript type definitions
```

### Development Setup

```bash
cd web
npm run dev
```

### Component Development

```typescript
// components/IntentForm.tsx
import { useState } from 'react';
import { useIntents } from '../hooks/useIntents';

interface IntentFormProps {
  onSubmit: (intent: IntentParams) => void;
}

export function IntentForm({ onSubmit }: IntentFormProps) {
  const [amount, setAmount] = useState('');
  const { createIntent, isLoading } = useIntents();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createIntent({
      tokenIn: '0x...',
      tokenOut: '0x...',
      amountIn: parseUnits(amount, 18)
    });
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form implementation */}
    </form>
  );
}
```

### State Management

Using Zustand for state management:

```typescript
// lib/store/intents.ts
import { create } from 'zustand';

interface IntentStore {
  intents: Intent[];
  activeIntent: Intent | null;
  setActiveIntent: (intent: Intent) => void;
  addIntent: (intent: Intent) => void;
}

export const useIntentStore = create<IntentStore>((set) => ({
  intents: [],
  activeIntent: null,
  setActiveIntent: (intent) => set({ activeIntent: intent }),
  addIntent: (intent) => set((state) => ({ 
    intents: [...state.intents, intent] 
  }))
}));
```

## Backend Development

### Service Architecture

```
backend/src/
├── relayer/             # Intent ingestion service
├── coordinator/         # Bid coordination service
├── websocket/          # Real-time communication
└── shared/             # Shared utilities
    ├── database/       # Database models and migrations
    ├── middleware/     # Express middleware
    ├── types/          # TypeScript types
    └── utils/          # Helper functions
```

### Creating Services

```typescript
// src/services/IntentService.ts
import { Injectable } from '@nestjs/common';
import { IntentRepository } from '../repositories/IntentRepository';

@Injectable()
export class IntentService {
  constructor(
    private intentRepository: IntentRepository
  ) {}
  
  async createIntent(params: CreateIntentParams): Promise<Intent> {
    // Validate intent
    await this.validateIntent(params);
    
    // Save to database
    const intent = await this.intentRepository.create(params);
    
    // Broadcast to solvers
    await this.broadcastIntent(intent);
    
    return intent;
  }
}
```

### Database Migrations

```sql
-- migrations/001_create_intents_table.sql
CREATE TABLE intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intent_hash BYTEA NOT NULL UNIQUE,
    user_address BYTEA NOT NULL,
    token_in BYTEA NOT NULL,
    token_out BYTEA NOT NULL,
    amount_in NUMERIC(78, 0) NOT NULL,
    max_slippage_bps INTEGER NOT NULL,
    deadline BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'broadcasted',
    created_at TIMESTAMP DEFAULT NOW(),
    settled_at TIMESTAMP,
    
    INDEX idx_intents_user (user_address),
    INDEX idx_intents_status (status),
    INDEX idx_intents_created (created_at)
);
```

## Solver Development

### Solver Architecture

Solvers are independent services that compete to provide the best execution for user intents.

### Building a Solver

1. **Setup**
   ```bash
   # Use the solver SDK
   npm install @intendly/solver-sdk
   
   # Or clone the reference implementation
   git clone https://github.com/intendly/reference-solver.git
   ```

2. **Basic Solver**
   ```typescript
   import { SolverSDK, BaseBidStrategy } from '@intendly/solver-sdk';
   
   class MySolver extends BaseBidStrategy {
     async calculateBid(intent: Intent): Promise<Bid> {
       // Get quotes from multiple sources
       const quotes = await Promise.all([
         this.getUniswapQuote(intent),
         this.get1InchQuote(intent),
         this.getParaSwapQuote(intent)
       ]);
       
       // Select best quote
       const bestQuote = quotes.reduce((best, current) => 
         current.amountOut > best.amountOut ? current : best
       );
       
       return {
         quoteOut: bestQuote.amountOut,
         solverFee: this.calculateFee(bestQuote),
         calldata: bestQuote.calldata,
         gasEstimate: bestQuote.gasEstimate
       };
     }
   }
   
   // Start solver
   const solver = new SolverSDK({
     strategy: new MySolver(),
     privateKey: process.env.SOLVER_PRIVATE_KEY
   });
   
   await solver.start();
   ```

3. **Advanced Features**
   - MEV protection strategies
   - Multi-hop routing optimization
   - Dynamic fee adjustment
   - Slippage prediction
   - Gas optimization

### Solver Performance

Monitor solver performance with metrics:

```typescript
// Track solver metrics
const metrics = {
  totalBids: 0,
  wonBids: 0,
  totalVolume: 0n,
  avgExecutionTime: 0,
  failureRate: 0
};

solver.onBidSubmitted((bid) => {
  metrics.totalBids++;
});

solver.onBidWon((bid) => {
  metrics.wonBids++;
  metrics.totalVolume += bid.amountIn;
});
```

## Best Practices

### Security

1. **Input Validation**
   - Validate all user inputs
   - Use type-safe parsing
   - Implement rate limiting

2. **Smart Contract Security**
   - Use reentrancy guards
   - Validate external calls
   - Implement access controls

3. **API Security**
   - Use HTTPS everywhere
   - Implement proper authentication
   - Rate limit API endpoints

### Performance

1. **Database Optimization**
   - Use appropriate indexes
   - Implement connection pooling
   - Cache frequently accessed data

2. **Frontend Performance**
   - Code splitting with Next.js
   - Image optimization
   - Lazy loading components

3. **Smart Contract Optimization**
   - Pack structs efficiently
   - Use events for data storage
   - Optimize gas usage

### Monitoring

1. **Application Metrics**
   - Response times
   - Error rates
   - Business metrics

2. **Infrastructure Metrics**
   - CPU and memory usage
   - Database performance
   - Network latency

3. **Alerting**
   - Set up critical alerts
   - Monitor business KPIs
   - Track user experience metrics

## Resources

### Documentation
- [Architecture Guide](./architecture.md)
- [API Reference](./api-reference.md)
- [Solver Guide](./solver-guide.md)
- [Deployment Guide](./deployment.md)

### Development Tools
- [Foundry](https://book.getfoundry.sh/) - Smart contract development
- [Next.js](https://nextjs.org/) - Frontend framework
- [Playwright](https://playwright.dev/) - End-to-end testing
- [Docker](https://docs.docker.com/) - Containerization

### Community
- **GitHub**: [https://github.com/intendly/intent-based-trading-aggregator](https://github.com/intendly/intent-based-trading-aggregator)
- **Discord**: [https://discord.gg/intendly](https://discord.gg/intendly)
- **Twitter**: [@intendly](https://twitter.com/intendly)

---

*Happy coding! 🚀*