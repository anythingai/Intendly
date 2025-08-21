# Intent-Based Trading Aggregator on L2s: System Architecture & Implementation Plan

## 1. Executive Summary

This document provides a comprehensive architectural analysis for the Intent-Based Trading Aggregator MVP on X Layer, designed for hackathon delivery. The system enables intent-first swapping where users express desired outcomes, and a competitive solver market executes optimal trades across DeFi venues.

### Key Architecture Principles
- **Intent-driven UX**: Single signature flow with EIP-712 + Permit2
- **Competitive execution**: Open solver market with transparent bidding
- **Atomic settlement**: On-chain enforcement of user constraints
- **L2-first design**: Optimized for X Layer with multi-L2 extensibility
- **Real-time coordination**: WebSocket-based intent broadcasting and bid collection

---

## 2. Technical Specifications Extracted from PRD

### 2.1 Core Requirements
- **Primary Chain**: X Layer (EVM L2), expandable to other L2s
- **Intent Schema**: EIP-712 typed data with 8 fields (tokenIn/Out, amountIn, slippage, deadline, etc.)
- **Signature System**: EIP-712 domain signing + Permit2 token approvals
- **Bidding Window**: 2-3 second competitive window for solver responses
- **Settlement**: Atomic on-chain execution with slippage protection
- **Success Metrics**: <2min end-to-end, ≥2 solvers responding in <3s, ≥20bps improvement

### 2.2 Performance Requirements
- **Latency**: Broadcast <500ms, bidding window 2-3s, settlement <30s
- **Throughput**: 100 intents/min capacity, 50 req/s per solver
- **Reliability**: 99% success rate for happy-path swaps
- **Security**: ReentrancyGuard, external call validation, fee caps

### 2.3 Data Model Requirements
```
intents: {intentHash, payload, signer, status, createdAt}
bids: {intentHash, solverId, quoteOut, solverFeeBps, payloadURI, arrivedAt}
fills: {intentHash, txHash, solverId, amountOut, solverFeePaid, timestamp}
solvers: {solverId, pubkey, metadata, isAllowed}
```

---

## 3. High-Level System Architecture

### 3.1 Component Overview
```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[Next.js dApp]
        WC[Wallet Connection]
        WS[WebSocket Client]
    end
    
    subgraph "Backend Services"
        REL[Relayer/Inbox]
        COORD[Coordinator]
        API[REST API Gateway]
        DB[(Database)]
        CACHE[(Redis Cache)]
    end
    
    subgraph "Blockchain Layer"
        SC[Settlement Contract]
        P2[Permit2]
        RT[DEX Router]
        L2[X Layer L2]
    end
    
    subgraph "Solver Network"
        SDK[Solver SDK]
        S1[Reference Solver]
        S2[Third-party Solvers]
        AGG[DEX Aggregators]
    end
    
    UI -->|EIP-712 Sign| REL
    REL -->|Broadcast| S1
    REL -->|Broadcast| S2
    S1 -->|Bid| COORD
    S2 -->|Bid| COORD
    COORD -->|Best Bid| UI
    UI -->|Execute| SC
    SC -->|Call| RT
    SC -->|Pull Tokens| P2
    
    REL --> DB
    COORD --> CACHE
    SDK --> AGG
```

### 3.2 Data Flow Specification
```mermaid
sequenceDiagram
    participant U as User
    participant UI as Frontend
    participant R as Relayer
    participant C as Coordinator
    participant S as Solvers
    participant SC as Settlement
    participant DEX as Router/DEX
    
    U->>UI: Enter intent params
    UI->>U: Request EIP-712 signature
    U->>UI: Sign intent
    UI->>R: POST /intents {intent, signature}
    R->>R: Validate & persist intent
    R->>S: WS broadcast intent
    S->>S: Compute quotes from DEXs
    S->>C: POST /bids {quote, fee, calldata}
    C->>C: Score bids, select winner
    C->>UI: WS best bid update
    UI->>U: Show best bid
    U->>UI: Click execute
    UI->>SC: submitAndSettle(intent, sig, bid, calldata)
    SC->>SC: Verify signature & constraints
    SC->>DEX: Execute router calldata
    DEX->>SC: Return tokens
    SC->>SC: Pay solver fee, send remainder to user
    SC->>UI: Emit IntentFilled event
    UI->>U: Show success + metrics
```

---

## 4. Detailed Component Specifications

### 4.1 Smart Contracts Layer

#### 4.1.1 IntentSettlement Contract
```solidity
// Core settlement contract specification
contract IntentSettlement {
    // Storage
    mapping(bytes32 => bool) public usedNonces;
    address public immutable permit2;
    address public immutable router;
    address public feeTreasury;
    uint16 public maxFeeBps;
    
    // Main settlement function
    function submitAndSettle(
        Intent calldata intent,
        bytes calldata userSig,
        BidLike calldata selectedBid,
        bytes calldata routerCalldata
    ) external nonReentrant;
}
```

**Key Features**:
- EIP-712 signature verification for intents
- Permit2 integration for gasless token approvals
- Atomic execution with slippage protection
- Solver fee distribution
- Comprehensive event emission
- Reentrancy protection

**Security Measures**:
- Router allowlist validation
- Fee cap enforcement (≤30bps solver fee)
- Nonce replay protection
- External call result validation

#### 4.1.2 Contract Interfaces
```solidity
interface IIntentSettlement {
    struct Intent {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint16 maxSlippageBps;
        uint64 deadline;
        uint256 chainId;
        address receiver;
        uint256 nonce;
    }
    
    struct BidLike {
        address solver;
        uint256 quoteOut;
        uint16 solverFeeBps;
        bytes calldataHint;
    }
    
    event IntentFilled(
        bytes32 indexed intentHash,
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address solver,
        uint256 fee
    );
}
```

### 4.2 Backend Services Layer

#### 4.2.1 Relayer/Inbox Service
**Purpose**: Intent ingestion, validation, and broadcasting
**Technology**: Node.js/Express with WebSocket support
**Key Responsibilities**:
- HTTP API for intent submission
- Basic intent validation (schema, signature, timing)
- WebSocket broadcasting to solver network
- Intent persistence and state management

**API Endpoints**:
```typescript
POST /intents
  Body: {intent: Intent, signature: string}
  Response: {intentHash: string, biddingWindowMs: number}

GET /intents/:hash
  Response: {intent: Intent, status: string, createdAt: string}
```

**WebSocket Channels**:
```typescript
ws://relayer/stream
Messages:
  - IntentCreated: {intentHash, intentSummary, timestamp}
  - IntentExpired: {intentHash, reason}
```

#### 4.2.2 Coordinator Service
**Purpose**: Bid collection, scoring, and winner selection
**Technology**: Node.js with Redis for real-time state
**Key Responsibilities**:
- Collect bids within bidding window
- Score bids: `effectiveOut = quoteOut * (1 - feeBps/10000)`
- Implement tie-breaking (earliest bid wins)
- Notify frontend of best bid updates

**API Endpoints**:
```typescript
POST /bids
  Body: {
    intentHash: string,
    quoteOut: string,
    solverFeeBps: number,
    calldataHint: string,
    ttlMs: number,
    solverSig: string
  }
  Headers: {
    'X-Solver-Id': string,
    'X-Solver-Signature': string
  }

GET /intents/:hash/bestBid
  Response: {bid: BidLike | null, score: number}
```

#### 4.2.3 Database Schema
```sql
-- PostgreSQL schema
CREATE TABLE intents (
    intent_hash VARCHAR(66) PRIMARY KEY,
    payload JSONB NOT NULL,
    signer VARCHAR(42) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bids (
    id SERIAL PRIMARY KEY,
    intent_hash VARCHAR(66) REFERENCES intents(intent_hash),
    solver_id VARCHAR(42) NOT NULL,
    quote_out NUMERIC(78,0) NOT NULL,
    solver_fee_bps INTEGER NOT NULL,
    payload_uri TEXT,
    arrived_at TIMESTAMP DEFAULT NOW(),
    solver_signature TEXT NOT NULL
);

CREATE TABLE fills (
    id SERIAL PRIMARY KEY,
    intent_hash VARCHAR(66) REFERENCES intents(intent_hash),
    tx_hash VARCHAR(66) NOT NULL,
    solver_id VARCHAR(42) NOT NULL,
    amount_out NUMERIC(78,0) NOT NULL,
    solver_fee_paid NUMERIC(78,0) NOT NULL,
    filled_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE solvers (
    solver_id VARCHAR(42) PRIMARY KEY,
    pubkey TEXT NOT NULL,
    metadata JSONB,
    is_allowed BOOLEAN DEFAULT true,
    registered_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_intents_status ON intents(status);
CREATE INDEX idx_intents_signer ON intents(signer);
CREATE INDEX idx_bids_intent_hash ON bids(intent_hash);
CREATE INDEX idx_bids_arrived_at ON bids(arrived_at);
```

### 4.3 Frontend dApp Layer

#### 4.3.1 Technology Stack
- **Framework**: Next.js 14 with App Router
- **Blockchain**: wagmi v2 + viem for wallet integration
- **State**: Zustand for client state management
- **UI**: Tailwind CSS + Headless UI components
- **Real-time**: WebSocket client for bid updates
- **Forms**: React Hook Form with zod validation

#### 4.3.2 Application Structure
```
/web
├── app/
│   ├── page.tsx                 # Main swap interface
│   ├── layout.tsx              # Root layout with providers
│   └── globals.css             # Tailwind styles
├── components/
│   ├── IntentForm.tsx          # Intent creation form
│   ├── BidDisplay.tsx          # Real-time bid visualization
│   ├── WalletConnect.tsx       # Wallet connection UI
│   ├── NetworkSwitcher.tsx     # Chain selection
│   └── TransactionStatus.tsx   # Post-execution feedback
├── hooks/
│   ├── useIntentFlow.ts        # Main flow orchestration
│   ├── useWebSocket.ts         # WS connection management
│   ├── useSignIntent.ts        # EIP-712 signing logic
│   └── useExecuteIntent.ts     # Contract interaction
├── lib/
│   ├── contracts/              # Contract ABIs & addresses
│   ├── eip712.ts              # Intent typing & signing
│   ├── api.ts                 # Backend API client
│   └── utils.ts               # Helper functions
└── types/
    ├── intent.ts              # Intent type definitions
    └── api.ts                 # API response types
```

#### 4.3.3 Key Components Specification
```typescript
// Intent creation form with validation
export const IntentForm: FC = () => {
  const { register, handleSubmit, watch } = useForm<IntentFormData>({
    resolver: zodResolver(intentSchema),
  });
  
  const { signIntent, isLoading } = useSignIntent();
  
  const onSubmit = async (data: IntentFormData) => {
    const intent = await signIntent(data);
    // Submit to relayer
  };
};

// Real-time bid display with WebSocket updates
export const BidDisplay: FC<{intentHash: string}> = ({intentHash}) => {
  const { bids, bestBid } = useWebSocket(intentHash);
  
  return (
    <div className="space-y-2">
      {bids.map(bid => (
        <BidCard key={bid.solverId} bid={bid} isBest={bid === bestBid} />
      ))}
    </div>
  );
};
```

### 4.4 Solver Infrastructure Layer

#### 4.4.1 Solver SDK Specification
**Purpose**: Standardized library for solver development
**Technology**: TypeScript with comprehensive type safety

```typescript
// Core SDK interface
export class SolverSDK {
  constructor(config: {
    solverPrivateKey: string;
    coordinatorUrl: string;
    wsUrl: string;
    chainId: number;
  });
  
  // Subscribe to intent broadcasts
  public subscribeToIntents(
    handler: (intent: Intent) => Promise<BidResponse | null>
  ): void;
  
  // Submit bids to coordinator
  public async submitBid(bid: Bid): Promise<{success: boolean; error?: string}>;
  
  // Quote aggregation helpers
  public async getQuoteFromAggregator(
    tokenIn: string, 
    tokenOut: string, 
    amountIn: bigint
  ): Promise<Quote>;
  
  // Calldata generation for router
  public async buildRouterCalldata(
    intent: Intent, 
    quote: Quote
  ): Promise<string>;
}
```

#### 4.4.2 Reference Solver Implementation
```typescript
// Example solver using multiple quote sources
export class ReferenceSolver {
  private sdk: SolverSDK;
  private quoteSources: QuoteSource[];
  
  constructor(config: SolverConfig) {
    this.sdk = new SolverSDK(config);
    this.quoteSources = [
      new UniswapV3Source(),
      new SushiSwapSource(),
      new CurveSource(),
    ];
  }
  
  public start() {
    this.sdk.subscribeToIntents(async (intent) => {
      try {
        // Get quotes from all sources
        const quotes = await Promise.all(
          this.quoteSources.map(source => 
            source.getQuote(intent.tokenIn, intent.tokenOut, intent.amountIn)
          )
        );
        
        // Select best quote
        const bestQuote = quotes.reduce((best, current) => 
          current.amountOut > best.amountOut ? current : best
        );
        
        // Calculate solver fee (competitive bidding)
        const solverFeeBps = this.calculateOptimalFee(intent, bestQuote);
        
        // Build router calldata
        const calldataHint = await this.sdk.buildRouterCalldata(intent, bestQuote);
        
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
  }
  
  private calculateOptimalFee(intent: Intent, quote: Quote): number {
    // Implement competitive fee calculation
    // Consider market conditions, profit margins, competition
    return Math.min(10, 30); // 0.10% default, max 0.30%
  }
}
```

---

## 5. API Contracts & Interface Definitions

### 5.1 REST API Specification
```typescript
// Complete API contract
interface IntentAPI {
  // Intent submission
  'POST /intents': {
    request: {
      intent: Intent;
      signature: string;
    };
    response: {
      intentHash: string;
      biddingWindowMs: number;
      expiresAt: string;
    };
  };
  
  // Bid submission
  'POST /bids': {
    request: {
      intentHash: string;
      quoteOut: string;
      solverFeeBps: number;
      calldataHint: string;
      ttlMs: number;
      solverSig: string;
    };
    response: {
      accepted: boolean;
      rank?: number;
      error?: string;
    };
  };
  
  // Query best bid
  'GET /intents/:hash/bestBid': {
    response: {
      bid: BidLike | null;
      totalBids: number;
      windowClosesAt: string;
    };
  };
}
```

### 5.2 WebSocket Message Specification
```typescript
// WebSocket message types
type WSMessage = 
  | {
      type: 'IntentCreated';
      data: {
        intentHash: string;
        intent: IntentSummary;
        biddingWindowMs: number;
        createdAt: string;
      };
    }
  | {
      type: 'BidReceived';
      data: {
        intentHash: string;
        solverId: string;
        quoteOut: string;
        solverFeeBps: number;
        rank: number;
      };
    }
  | {
      type: 'BestBidUpdated';
      data: {
        intentHash: string;
        bestBid: BidLike;
        score: number;
        improvement: string; // bps vs baseline
      };
    }
  | {
      type: 'IntentFilled';
      data: {
        intentHash: string;
        txHash: string;
        amountOut: string;
        solverFeePaid: string;
        filledAt: string;
      };
    };
```

### 5.3 EIP-712 Type Definitions
```typescript
// Complete EIP-712 specification
export const EIP712_DOMAIN = {
  name: 'IntentSwap',
  version: '1',
  chainId: 196, // X Layer
  verifyingContract: '0x...', // Settlement contract address
} as const;

export const EIP712_TYPES = {
  Intent: [
    {name: 'tokenIn', type: 'address'},
    {name: 'tokenOut', type: 'address'},
    {name: 'amountIn', type: 'uint256'},
    {name: 'maxSlippageBps', type: 'uint16'},
    {name: 'deadline', type: 'uint64'},
    {name: 'chainId', type: 'uint256'},
    {name: 'receiver', type: 'address'},
    {name: 'nonce', type: 'uint256'},
  ],
} as const;

export interface Intent {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  maxSlippageBps: number; // 0-500 (0-5%)
  deadline: bigint; // Unix timestamp
  chainId: bigint;
  receiver: Address;
  nonce: bigint;
}
```

---

## 6. Technology Stack Recommendations

### 6.1 Smart Contracts
- **Language**: Solidity 0.8.19+
- **Framework**: Foundry for development, testing, deployment
- **Libraries**: OpenZeppelin (ReentrancyGuard, SafeERC20)
- **Testing**: Foundry tests + fork testing against X Layer
- **Verification**: Etherscan/Blockscout contract verification

### 6.2 Backend Services
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with helmet, cors, rate limiting
- **Database**: PostgreSQL 14+ with connection pooling
- **Cache**: Redis 7+ for real-time state and session management
- **WebSocket**: ws library with heartbeat and reconnection logic
- **Deployment**: Docker containers with health checks

### 6.3 Frontend Application
- **Framework**: Next.js 14 with App Router and TypeScript
- **Blockchain**: wagmi v2 + viem for type-safe contract interaction
- **Styling**: Tailwind CSS v3 with custom design system
- **State Management**: Zustand for client-side state
- **Forms**: React Hook Form + Zod for validation
- **Real-time**: Native WebSocket API with reconnection logic

### 6.4 Infrastructure & DevOps
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose for local development
- **Monitoring**: Prometheus + Grafana for metrics
- **Logging**: Structured JSON logging with Winston
- **CI/CD**: GitHub Actions for automated testing and deployment

---

## 7. Development Approach & Dependencies

### 7.1 Component Dependency Graph
```mermaid
graph TD
    C[Smart Contracts] --> B[Backend Services]
    C --> F[Frontend dApp]
    B --> F
    B --> S[Solver SDK]
    S --> RS[Reference Solver]
    
    subgraph "Development Order"
        C1[Contract Interfaces] --> C2[Settlement Contract]
        C2 --> C3[Contract Testing]
        C3 --> B1[Relayer API]
        B1 --> B2[Coordinator Logic]
        B2 --> S1[SDK Core]
        S1 --> F1[Frontend Components]
        S1 --> RS1[Reference Solver]
        F1 --> I[Integration Testing]
        RS1 --> I
    end
```

### 7.2 Development Phases

#### Phase 1: Core Infrastructure (Days 0-0.5)
1. **Smart Contract Foundation**
   - Deploy Permit2 on testnet (if needed)
   - Implement IntentSettlement contract
   - Write comprehensive unit tests
   - Deploy to X Layer testnet

2. **Backend Scaffold**
   - Set up Express server with TypeScript
   - Implement basic REST endpoints
   - Set up PostgreSQL + Redis
   - Create WebSocket broadcasting

#### Phase 2: Integration & Solver Network (Days 0.5-1)
1. **Solver SDK Development**
   - Create TypeScript SDK with intent subscription
   - Implement bid submission and signing
   - Add quote aggregation helpers

2. **Reference Solver**
   - Build solver using SDK
   - Integrate with 1-2 DEX quote sources
   - Implement competitive bidding logic

3. **Frontend Foundation**
   - Set up Next.js with wagmi integration
   - Build intent creation form
   - Implement EIP-712 signing flow

#### Phase 3: End-to-End Flow (Days 1-1.5)
1. **Complete Integration**
   - Connect frontend to backend APIs
   - Implement real-time bid updates
   - Add contract execution flow

2. **Testing & Optimization**
   - End-to-end testing on testnet
   - Performance optimization
   - Error handling and edge cases

#### Phase 4: Polish & Demo (Days 1.5-2)
1. **Production Readiness**
   - Deploy second solver for competition
   - Add monitoring and observability
   - UI/UX polish and responsive design

2. **Demo Preparation**
   - Create demo script and test data
   - Record demo video
   - Finalize documentation

### 7.3 Critical Path Dependencies
1. **Permit2 Integration**: Must be deployed and accessible on X Layer
2. **DEX Router**: Need confirmed router contract addresses for X Layer
3. **RPC Access**: Reliable X Layer RPC endpoints for development and production
4. **Token Addresses**: Confirmed addresses for WETH, USDC on X Layer testnet/mainnet

---

## 8. Key Architectural Decisions & Trade-offs

### 8.1 Design Decisions

#### Decision 1: Centralized Coordinator vs Fully Decentralized Auction
**Choice**: Centralized coordinator with transparent bid selection
**Rationale**: 
- Faster time-to-market for hackathon
- Simpler solver integration
- Easier to ensure fair bid ordering and timing
**Trade-off**: Single point of failure vs decentralization purity
**Future Path**: Could migrate to on-chain auction or decentralized coordination

#### Decision 2: EIP-712 + Permit2 vs Traditional Approvals
**Choice**: EIP-712 intent signing with Permit2 token pulls
**Rationale**:
- Superior UX with single signature
- Gasless intent creation
- Industry standard for intent-based systems
**Trade-off**: Additional complexity vs user experience
**Dependencies**: Permit2 deployment on X Layer

#### Decision 3: WebSocket Broadcasting vs Pull-based Solver Updates
**Choice**: WebSocket broadcasting for real-time intent distribution
**Rationale**:
- Lower latency for time-sensitive arbitrage
- Better solver experience with push notifications
- Scalable to many solvers
**Trade-off**: Connection management complexity vs polling overhead

#### Decision 4: TypeScript SDK vs Language-Agnostic Protocol
**Choice**: TypeScript-first SDK with documented protocol
**Rationale**:
- Faster development for hackathon timeline
- Better developer experience for most solvers
- Still allows other languages via HTTP/WS protocol
**Trade-off**: Language limitation vs development speed

### 8.2 Security Trade-offs

#### Settlement Contract Security
- **Immutable vs Upgradeable**: Chose immutable for hackathon trust
- **Router Allowlist**: Whitelist specific routers to prevent malicious calls
- **Fee Caps**: Enforce maximum solver fees to protect users
- **Reentrancy**: Full reentrancy protection despite gas overhead

#### Solver Network Security
- **Allowlist vs Permissionless**: Start with allowlist for demo safety
- **Key Management**: Server-side solver keys for hackathon simplicity
- **Rate Limiting**: Aggressive rate limits to prevent spam

### 8.3 Scalability Considerations

#### Current Limitations
- Single coordinator bottleneck
- PostgreSQL as primary database
- WebSocket connection limits

#### Scaling Path
- Horizontal coordinator scaling with Redis coordination
- Database sharding by chain/time
- WebSocket load balancing and connection pooling

---

## 9. Implementation Roadmap

### 9.1 Pre-Development Setup
- [ ] X Layer testnet access and funding
- [ ] Confirm Permit2 deployment status
- [ ] Identify DEX router contracts on X Layer
- [ ] Set up development infrastructure (databases, services)

### 9.2 Sprint Breakdown

#### Sprint 1: Foundation (6 hours)
- [ ] Smart contract development and testing
- [ ] Backend API scaffold with database
- [ ] Basic frontend setup with wallet connection
- [ ] Local development environment

#### Sprint 2: Core Features (8 hours)  
- [ ] Complete intent flow (create, sign, submit)
- [ ] WebSocket broadcasting system
- [ ] Solver SDK development
- [ ] Reference solver implementation

#### Sprint 3: Integration (6 hours)
- [ ] End-to-end flow testing
- [ ] Real-time bid updates in UI
- [ ] Contract settlement execution
- [ ] Error handling and validation

#### Sprint 4: Production & Demo (4 hours)
- [ ] Deploy to X Layer testnet/mainnet
- [ ] Multiple solver deployment
- [ ] Performance optimization
- [ ] Demo recording and documentation

### 9.3 Risk Mitigation

#### Technical Risks
- **X Layer Compatibility**: Early testing with simple contracts
- **Permit2 Availability**: Fallback to standard ERC20 approvals if needed
- **DEX Integration**: Start with proven routers (Uniswap V3)
- **WebSocket Stability**: Implement reconnection and heartbeat logic

#### Timeline Risks
- **Scope Creep**: Strict MVP focus, defer stretch features
- **Integration Issues**: Extensive mocking for parallel development
- **Deployment Issues**: Early and frequent testnet deployments

---

## 10. Observability & Monitoring

### 10.1 Key Metrics
```typescript
// Metrics to track across system
interface SystemMetrics {
  // Intent metrics
  intentsCreated: number;
  intentsFilled: number;
  averageTimeToFirstBid: number; // milliseconds
  averageTimeToSettle: number; // milliseconds
  
  // Solver metrics
  activeSolvers: number;
  averageBidsPerIntent: number;
  solverWinRate: Record<string, number>; // solverId -> win %
  
  // Economic metrics
  averagePriceImprovement: number; // basis points
  totalVolumeSettled: bigint;
  averageSolverFee: number; // basis points
  
  // System health
  wsConnectionCount: number;
  apiLatencyP95: number;
  errorRate: number;
}
```

### 10.2 Logging Strategy
```typescript
// Structured logging format
interface LogEvent {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  component: 'relayer' | 'coordinator' | 'contract' | 'frontend';
  event: string;
  intentHash?: string;
  solverId?: string;
  txHash?: string;
  metadata: Record<string, any>;
}

// Example log events
const intentCreatedLog: LogEvent = {
  timestamp: '2024-01-01T00:00:00.000Z',
  level: 'info',
  component: 'relayer',
  event: 'intent_created',
  intentHash: '0xabc...',
  metadata: {
    tokenIn: '0x...',
    tokenOut: '0x...',
    amountIn: '1000000000000000000',
    signer: '0x...'
  }
};
```

---

## 11. Testing Strategy

### 11.1 Smart Contract Testing
```solidity
// Comprehensive test coverage
contract IntentSettlementTest is Test {
    function testSuccessfulSettlement() public {
        // Happy path: valid intent, successful router call
    }
    
    function testSlippageProtection() public {
        // Ensure settlement reverts if amountOut < minOut
    }
    
    function testFeeDistribution() public {
        // Verify correct solver fee calculation and transfer
    }
    
    function testReentrancyProtection() public {
        // Attempt reentrancy attack via malicious token
    }
    
    function testPermit2Integration() public {
        // Test token pulling via Permit2
    }
    
    function fuzzTestIntentParameters(
        uint256 amountIn,
        uint16 slippageBps,
        uint64 deadline
    ) public {
        // Fuzz test with random valid parameters
    }
}
```

### 11.2 Integration Testing
```typescript
// End-to-end test scenarios
describe('Intent Flow Integration', () => {
  it('should complete full intent-to-settlement flow', async () => {
    // 1. User creates and signs intent
    // 2. Relayer broadcasts intent
    // 3. Solver receives and bids
    // 4. Coordinator selects best bid
    // 5. User executes settlement
// 1. User creates and signs intent
    const intent = await createTestIntent();
    const signature = await signIntent(intent, userWallet);
    
    // 2. Relayer broadcasts intent
    const response = await relayerClient.submitIntent({intent, signature});
    expect(response.intentHash).toBeDefined();
    
    // 3. Solver receives and bids
    await waitForWebSocketMessage('IntentCreated');
    const bid = await testSolver.generateBid(intent);
    
    // 4. Coordinator selects best bid
    await coordinatorClient.submitBid(bid);
    const bestBid = await coordinatorClient.getBestBid(response.intentHash);
    expect(bestBid).toEqual(bid);
    
    // 5. User executes settlement
    const settlementTx = await settlementContract.submitAndSettle(
      intent, signature, bestBid, bid.calldataHint
    );
    
    // 6. Verify final state
    expect(await tokenOut.balanceOf(intent.receiver)).toBeGreaterThan(0);
    expect(await tokenIn.balanceOf(testSolver.address)).toBeGreaterThan(0);
  });
  
  it('should handle competing solver bids correctly', async () => {
    // Test multiple solvers competing for same intent
  });
  
  it('should respect slippage protection', async () => {
    // Test settlement failure when slippage exceeded
  });
  
  it('should handle expired intents', async () => {
    // Test behavior with past deadline
  });
});
```

### 11.3 Performance Testing
```typescript
// Load testing scenarios
describe('System Performance', () => {
  it('should handle 100 intents per minute', async () => {
    const intents = Array.from({length: 100}, () => createTestIntent());
    const startTime = Date.now();
    
    const results = await Promise.allSettled(
      intents.map(intent => processIntentFlow(intent))
    );
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(60000); // 1 minute
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(100);
  });
  
  it('should maintain < 3s bidding window latency', async () => {
    const intent = await createTestIntent();
    const startTime = Date.now();
    
    await relayerClient.submitIntent(intent);
    await waitForFirstBid(intent.hash);
    
    const latency = Date.now() - startTime;
    expect(latency).toBeLessThan(3000);
  });
});
```

---

## 12. Complete Project Structure

### 12.1 Repository Organization
```
intendly/
├── README.md
├── docker-compose.yml
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── contracts/                          # Smart contracts
│   ├── src/
│   │   ├── IntentSettlement.sol
│   │   ├── interfaces/
│   │   │   ├── IIntentSettlement.sol
│   │   │   ├── IPermit2.sol
│   │   │   └── IRouter.sol
│   │   └── libraries/
│   │       └── IntentHashLib.sol
│   ├── test/
│   │   ├── IntentSettlement.t.sol
│   │   ├── IntentSettlement.fork.t.sol
│   │   └── utils/
│   │       └── TestUtils.sol
│   ├── script/
│   │   ├── Deploy.s.sol
│   │   └── Verify.s.sol
│   ├── foundry.toml
│   └── package.json
├── backend/                           # Backend services
│   ├── src/
│   │   ├── relayer/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── intents.ts
│   │   │   │   └── health.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── validation.ts
│   │   │   │   └── rateLimit.ts
│   │   │   └── services/
│   │   │       ├── intentService.ts
│   │   │       └── broadcastService.ts
│   │   ├── coordinator/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   └── bids.ts
│   │   │   └── services/
│   │   │       ├── bidService.ts
│   │   │       └── scoringService.ts
│   │   ├── shared/
│   │   │   ├── database/
│   │   │   │   ├── connection.ts
│   │   │   │   └── models/
│   │   │   │       ├── Intent.ts
│   │   │   │       ├── Bid.ts
│   │   │   │       └── Solver.ts
│   │   │   ├── types/
│   │   │   │   ├── intent.ts
│   │   │   │   ├── bid.ts
│   │   │   │   └── api.ts
│   │   │   ├── utils/
│   │   │   │   ├── crypto.ts
│   │   │   │   ├── validation.ts
│   │   │   │   └── logger.ts
│   │   │   └── config/
│   │   │       └── index.ts
│   │   └── websocket/
│   │       ├── server.ts
│   │       ├── handlers/
│   │       └── types.ts
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_indexes.sql
│   │   └── 003_solver_registry.sql
│   ├── tests/
│   │   ├── integration/
│   │   ├── unit/
│   │   └── fixtures/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.js
├── solver-sdk/                       # TypeScript SDK
│   ├── src/
│   │   ├── index.ts
│   │   ├── SolverSDK.ts
│   │   ├── types/
│   │   │   ├── intent.ts
│   │   │   ├── bid.ts
│   │   │   └── config.ts
│   │   ├── services/
│   │   │   ├── QuoteAggregator.ts
│   │   │   ├── WebSocketClient.ts
│   │   │   └── APIClient.ts
│   │   ├── sources/
│   │   │   ├── UniswapV3Source.ts
│   │   │   ├── SushiSwapSource.ts
│   │   │   └── BaseQuoteSource.ts
│   │   └── utils/
│   │       ├── signing.ts
│   │       └── formatting.ts
│   ├── examples/
│   │   ├── reference-solver/
│   │   │   ├── index.ts
│   │   │   ├── ReferenceSolver.ts
│   │   │   ├── strategies/
│   │   │   │   └── BasicStrategy.ts
│   │   │   └── package.json
│   │   └── advanced-solver/
│   ├── tests/
│   ├── docs/
│   │   ├── quickstart.md
│   │   └── api-reference.md
│   ├── package.json
│   └── tsconfig.json
├── web/                              # Frontend dApp
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── providers.tsx
│   ├── components/
│   │   ├── ui/                       # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Spinner.tsx
│   │   ├── wallet/
│   │   │   ├── WalletConnect.tsx
│   │   │   └── NetworkSwitcher.tsx
│   │   ├── intent/
│   │   │   ├── IntentForm.tsx
│   │   │   ├── IntentSummary.tsx
│   │   │   └── IntentHistory.tsx
│   │   ├── bids/
│   │   │   ├── BidDisplay.tsx
│   │   │   ├── BidCard.tsx
│   │   │   └── BidComparison.tsx
│   │   ├── execution/
│   │   │   ├── ExecuteButton.tsx
│   │   │   ├── TransactionStatus.tsx
│   │   │   └── SuccessDialog.tsx
│   │   └── analytics/
│   │       └── MetricsPanel.tsx
│   ├── hooks/
│   │   ├── useIntentFlow.ts
│   │   ├── useSignIntent.ts
│   │   ├── useExecuteIntent.ts
│   │   ├── useWebSocket.ts
│   │   ├── useBids.ts
│   │   └── useTokens.ts
│   ├── lib/
│   │   ├── contracts/
│   │   │   ├── addresses.ts
│   │   │   ├── abis.ts
│   │   │   └── types.ts
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── intents.ts
│   │   │   └── bids.ts
│   │   ├── crypto/
│   │   │   ├── eip712.ts
│   │   │   └── signing.ts
│   │   ├── utils/
│   │   │   ├── format.ts
│   │   │   ├── validation.ts
│   │   │   └── constants.ts
│   │   └── wagmi/
│   │       └── config.ts
│   ├── types/
│   │   ├── intent.ts
│   │   ├── bid.ts
│   │   ├── api.ts
│   │   └── wallet.ts
│   ├── styles/
│   │   └── globals.css
│   ├── public/
│   │   ├── icons/
│   │   └── images/
│   ├── __tests__/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── tsconfig.json
├── docs/                             # Documentation
│   ├── architecture.md
│   ├── api-reference.md
│   ├── solver-guide.md
│   ├── deployment.md
│   └── demo-script.md
├── scripts/                          # Deployment & utility scripts
│   ├── deploy-contracts.sh
│   ├── setup-local.sh
│   ├── run-tests.sh
│   └── create-solver.ts
└── .env.example
```

### 12.2 Environment Configuration
```bash
# .env.example - Complete environment variable template

# Blockchain Configuration
CHAIN_ID=196
RPC_URL=https://xlayer-rpc.example.com
PERMIT2_ADDRESS=0x000000000022D473030F116dDEE9F6B43aC78BA3
ROUTER_ADDRESS=0x...  # X Layer router address
SETTLEMENT_CONTRACT_ADDRESS=0x...

# Backend Services
DATABASE_URL=postgresql://user:pass@localhost:5432/intendly
REDIS_URL=redis://localhost:6379
API_PORT=3001
WS_PORT=3002
COORDINATOR_URL=http://localhost:3001
WS_URL=ws://localhost:3002

# Security & API Keys
JWT_SECRET=your-jwt-secret
SOLVER_REGISTRY_PRIVATE_KEY=0x...
API_RATE_LIMIT_WINDOW=900000  # 15 minutes
API_RATE_LIMIT_MAX=100

# Monitoring & Logging
LOG_LEVEL=info
METRICS_ENABLED=true
PROMETHEUS_PORT=9090

# Frontend Configuration
NEXT_PUBLIC_CHAIN_ID=196
NEXT_PUBLIC_WS_URL=ws://localhost:3002
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SETTLEMENT_CONTRACT=0x...
NEXT_PUBLIC_PERMIT2_ADDRESS=0x000000000022D473030F116dDEE9F6B43aC78BA3

# Development
NODE_ENV=development
ENABLE_DEBUG=true
MOCK_SOLVER_ENABLED=true

# Deployment (Production)
DOCKER_REGISTRY=ghcr.io/yourorg
DEPLOYMENT_ENV=staging|production
SSL_CERT_PATH=/etc/ssl/certs/
SSL_KEY_PATH=/etc/ssl/private/
```

---

## 13. Final Recommendations & Next Steps

### 13.1 Critical Success Factors
1. **Early X Layer Integration**: Validate all blockchain interactions early
2. **Robust WebSocket Infrastructure**: Implement proper connection handling and failover
3. **Comprehensive Testing**: Prioritize integration testing over unit tests for time constraints
4. **Solver Ecosystem**: Focus on reference solver quality to attract third-party developers
5. **User Experience**: Single-click experience is crucial for demonstration success

### 13.2 Risk Mitigation Strategies
```typescript
// Implementation checkpoints and fallbacks
const riskMitigations = {
  'X Layer Compatibility': {
    checkpoint: 'Deploy simple contract within first 2 hours',
    fallback: 'Switch to Polygon zkEVM or Base if issues persist'
  },
  'Permit2 Availability': {
    checkpoint: 'Confirm Permit2 deployment or deploy own',
    fallback: 'Implement traditional ERC20 approval flow'
  },
  'WebSocket Reliability': {
    checkpoint: 'Test connection handling under load',
    fallback: 'Implement HTTP polling as backup mechanism'
  },
  'DEX Router Integration': {
    checkpoint: 'Successful swap execution within 6 hours',
    fallback: 'Use direct Uniswap V3 integration'
  }
};
```

### 13.3 Post-Hackathon Evolution Path
1. **Decentralization**: Migrate from centralized coordinator to on-chain auction
2. **Multi-Chain**: Add support for Base, Optimism, Arbitrum
3. **Advanced Features**: Batch intents, cross-chain bridging, private mempools
4. **Governance**: Introduce protocol governance and solver slashing mechanisms
5. **Economic Sustainability**: Implement protocol fees and solver incentive mechanisms

### 13.4 Technology Upgrade Path
```typescript
// Future architecture considerations
interface FutureArchitecture {
  coordination: 'on-chain auction' | 'decentralized coordinator network';
  settlement: 'cross-chain capable' | 'L1 settlement layer';
  privacy: 'commit-reveal auctions' | 'private solver bids';
  governance: 'DAO-controlled parameters' | 'algorithmic fee adjustment';
  scaling: 'horizontal coordinator scaling' | 'L2 native coordination';
}
```

---

## 14. Conclusion

This architectural design provides a comprehensive blueprint for implementing the Intent-Based Trading Aggregator MVP. The system prioritizes:

1. **User Experience**: Single signature, transparent bidding, fast execution
2. **Developer Experience**: Clear APIs, comprehensive SDK, detailed documentation  
3. **Extensibility**: Modular design allowing easy L2 expansion and feature addition
4. **Security**: Multi-layered validation, economic incentives, and battle-tested patterns
5. **Performance**: Real-time coordination with sub-3-second bidding windows

The architecture balances hackathon delivery constraints with production-ready design patterns, ensuring both immediate demonstration success and long-term evolution potential.

**Key Deliverables:**
- Complete smart contract specification with security considerations
- Backend service architecture with real-time capabilities
- Frontend dApp design with optimal UX flow  
- Solver SDK enabling easy third-party integration
- Comprehensive testing and deployment strategy
- Detailed implementation roadmap with risk mitigation

This blueprint serves as the definitive guide for the implementation team to deliver a compelling, functional Intent-Based Trading Aggregator that showcases the future of DeFi user experience.

---

*Architecture Document Version 1.0 - Created for Intent-Based Trading Aggregator Hackathon Project*
    // 6.