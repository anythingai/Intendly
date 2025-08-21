# Intent-Based Trading Aggregator - Backend Services

Complete Node.js/TypeScript backend infrastructure for intent-based trading coordination.

## 🏗️ Architecture Overview

The backend consists of three main services that work together to process intents and coordinate bids:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Relayer API   │    │  Coordinator    │    │  WebSocket      │
│   Port: 3001    │    │   Port: 3001    │    │   Port: 3002    │
│                 │    │                 │    │                 │
│ • POST /intents │    │ • POST /bids    │    │ • Intent broad. │
│ • GET /intents  │◄──►│ • GET /bestBid  │◄──►│ • Bid updates   │
│ • Validation    │    │ • Bid scoring   │    │ • Status sync   │
│ • Persistence   │    │ • Winner sel.   │    │ • Heartbeat     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────────┐
                    │   Shared Services   │
                    │                     │
                    │ • Database (PG)     │
                    │ • Redis Cache       │
                    │ • Blockchain        │
                    │ • Authentication    │
                    │ • Logging/Metrics   │
                    └─────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker (optional)

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your database and blockchain settings

# Run database migrations
npm run db:migrate

# Start all services in development
npm run dev
```

### Using Docker

```bash
# Start infrastructure services
docker-compose up -d postgres redis

# Run migrations
npm run db:migrate

# Start backend services
npm run dev
```

## 📡 API Endpoints

### Relayer Service (Port 3001)

#### Submit Intent
```bash
POST /api/intents
Content-Type: application/json

{
  "intent": {
    "tokenIn": "0x1234567890123456789012345678901234567890",
    "tokenOut": "0x0987654321098765432109876543210987654321",
    "amountIn": "1000000000000000000",
    "maxSlippageBps": 300,
    "deadline": "1703980800",
    "chainId": "196",
    "receiver": "0x1111111111111111111111111111111111111111",
    "nonce": "12345"
  },
  "signature": "0x1234567890abcdef..."
}
```

#### Get Intent Details
```bash
GET /api/intents/{intentHash}
```

#### Health Check
```bash
GET /health
```

### Coordinator Service (Port 3001)

#### Submit Bid
```bash
POST /api/bids
Content-Type: application/json

{
  "intentHash": "0xabcdef...",
  "quoteOut": "1100000000000000000",
  "solverFeeBps": 30,
  "calldataHint": "0x1234",
  "ttlMs": 2000,
  "solverSig": "0x1234567890abcdef..."
}
```

#### Get Best Bid
```bash
GET /api/intents/{intentHash}/bestBid
```

### WebSocket Server (Port 3002)

#### Connection
```javascript
const ws = new WebSocket(`ws://localhost:3002/stream?token=${jwtToken}`);

// Subscribe to solver intents
ws.send(JSON.stringify({
  type: 'Subscribe',
  channel: 'solver:intents'
}));

// Listen for intent broadcasts
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

## 🔧 Configuration

### Environment Variables

```bash
# Server Configuration
API_PORT=3001
WS_PORT=3002
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/intendly
REDIS_URL=redis://localhost:6379

# Blockchain
CHAIN_ID=196
RPC_URL=https://xlayerrpc.okx.com
PERMIT2_ADDRESS=0x000000000022D473030F116dDEE9F6B43aC78BA3
ROUTER_ADDRESS=0x1234567890123456789012345678901234567890
SETTLEMENT_CONTRACT_ADDRESS=0x0987654321098765432109876543210987654321

# Security
JWT_SECRET=your-256-bit-secret-key-here
API_RATE_LIMIT_MAX=100

# Bidding
BIDDING_WINDOW_MS=3000
MAX_SOLVER_FEE_BPS=100
```

## 🏛️ Database Schema

### Tables

#### `intents`
- `intent_hash` - Primary key (66 chars)
- `payload` - JSONB intent data
- `signature` - EIP-712 signature
- `signer` - Ethereum address
- `status` - Intent lifecycle status
- `created_at`, `updated_at`, `expires_at`
- `total_bids`, `best_bid`

#### `bids`
- `id` - UUID primary key
- `intent_hash` - Foreign key to intents
- `solver_id` - Solver Ethereum address
- `quote_out` - Bid output amount
- `solver_fee_bps` - Solver fee in basis points
- `solver_signature` - Bid signature
- `status` - Bid status
- `arrived_at` - Timestamp
- `rank`, `score` - Bid ranking data

#### `solvers`
- `id` - UUID primary key
- `solver_id` - Ethereum address (unique)
- `public_key` - For signature verification
- `metadata` - JSONB solver info
- `is_allowed` - Boolean
- `total_bids`, `won_bids`, `win_rate`

#### `fills`
- `id` - UUID primary key
- `intent_hash` - Reference to filled intent
- `winning_bid_id` - Reference to winning bid
- `tx_hash` - Settlement transaction
- `amount_out`, `solver_fee_paid`
- `filled_at` - Settlement timestamp

## 📊 Monitoring & Metrics

### Prometheus Metrics

```bash
# View metrics
curl http://localhost:3001/metrics
curl http://localhost:3001/health
```

### Key Metrics
- `intendly_http_requests_total` - HTTP request count
- `intendly_intents_total` - Intent processing count
- `intendly_bids_total` - Bid processing count
- `intendly_websocket_connections_active` - Active WebSocket connections
- `intendly_database_query_duration_seconds` - Database performance
- `intendly_intent_fill_rate` - Business metric for fill success

### Logging

Structured JSON logging with Winston:

```json
{
  "level": "info",
  "message": "Intent created",
  "service": "relayer",
  "intentHash": "0xabcdef...",
  "signer": "0x1111...",
  "tokenIn": "0x1234...",
  "tokenOut": "0x0987...",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 🔐 Security Features

### Authentication
- JWT-based authentication for API endpoints
- Solver authentication for WebSocket connections
- API key authentication for internal services

### Rate Limiting
- Per-IP rate limiting on public endpoints
- Separate limits for intent submission (10/min) and bid submission (50/10s)
- User-based limits for authenticated requests

### Input Validation
- Schema validation with express-validator
- EIP-712 signature verification
- Address format validation
- Amount and fee validation

### Security Headers
- Helmet.js security headers
- CORS configuration
- Request size limits
- XSS protection

## 🧪 Testing

### Unit Tests
```bash
npm run test:unit
```

### Integration Tests
```bash
npm run test:integration
```

### Coverage Report
```bash
npm run test:coverage
```

### Load Testing
```bash
# Install Artillery
npm install -g artillery

# Run load tests
artillery run tests/load/intent-submission.yml
```

## 🚀 Deployment

### Production Build
```bash
npm run build
npm run start
```

### Docker Production
```bash
docker build -t intendly-backend .
docker run -p 3001:3001 -p 3002:3002 intendly-backend
```

### Environment-Specific Configurations

#### Development
- Debug logging enabled
- Hot reloading with tsx
- Detailed error messages
- Mock solver enabled

#### Staging
- Production-like environment
- Rate limiting enabled
- Metrics collection
- Test data isolation

#### Production
- Optimized logging
- Security hardening
- Performance monitoring
- Backup strategies

## 📈 Performance Characteristics

### Benchmarks
- Intent processing: <100ms p95
- Bid submission: <50ms p95
- WebSocket latency: <10ms p95
- Database queries: <20ms p95
- Bidding window: 3000ms default

### Scalability
- Horizontal scaling with Redis pub/sub
- Database connection pooling
- Stateless service design
- Load balancer ready

## 🔄 System Integration Flow

### 1. Intent Submission
```
Frontend/User → Relayer API → Database → Redis → WebSocket → Solvers
```

### 2. Bid Processing
```
Solver → Coordinator API → Database → Scoring Engine → Redis → WebSocket → Frontend
```

### 3. Winner Selection
```
Timer → Coordinator → Best Bid Selection → Database → Blockchain → Settlement
```

### 4. Real-time Updates
```
Redis Pub/Sub → WebSocket Server → Connected Clients (Frontend/Solvers)
```

## 🛠️ Development

### Code Structure
```
src/
├── relayer/              # Intent ingestion service
│   ├── routes/          # HTTP route handlers
│   ├── services/        # Business logic
│   └── index.ts         # Service entry point
├── coordinator/          # Bid coordination service
│   ├── routes/          # HTTP route handlers
│   ├── services/        # Bid processing logic
│   └── index.ts         # Service entry point
├── websocket/           # Real-time communication
│   ├── handlers/        # Message handlers
│   └── server.ts        # WebSocket server
└── shared/              # Shared components
    ├── config/          # Configuration management
    ├── database/        # Database models & migrations
    ├── middleware/      # Express middleware
    ├── types/           # TypeScript definitions
    └── utils/           # Utility functions
```

### Adding New Features
1. Define types in `shared/types/`
2. Create database migrations in `database/migrations/`
3. Implement business logic in service classes
4. Add API routes with validation
5. Update WebSocket message handlers
6. Add comprehensive tests
7. Update metrics and logging

## 🤝 Contributing

1. Follow TypeScript strict mode
2. Use structured logging with context
3. Add comprehensive error handling
4. Include unit and integration tests
5. Update documentation
6. Follow security best practices

## 📚 Additional Resources

- [Intent-Based Trading Specification](../docs/intent-specification.md)
- [Solver Integration Guide](../docs/solver-guide.md)
- [API Reference](../docs/api-reference.md)
- [Deployment Guide](../docs/deployment.md)