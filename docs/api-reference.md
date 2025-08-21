# API Reference

Complete API documentation for the Intent-Based Trading Aggregator.

## Base URLs

- **Development**: `http://localhost:3001`
- **Staging**: `https://api-staging.intendly.xyz`
- **Production**: `https://api.intendly.xyz`

## Authentication

Most endpoints are public, but solver registration requires authentication.

```bash
# Example with API key
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.intendly.xyz/api/solvers
```

## Intent Endpoints

### Submit Intent

Create a new trading intent.

**Endpoint**: `POST /api/intents`

**Request Body**:
```json
{
  "intent": {
    "tokenIn": "0xA0b86a33E6417aE5b7cf4e3476BB981a3b7f2cFB",
    "tokenOut": "0x74b7F16337b8972027F6196A17a631aC6dE26d22",
    "amountIn": "1000000000000000000",
    "maxSlippageBps": 50,
    "deadline": "1703980800",
    "chainId": "196",
    "receiver": "0x742C1B41e6E8e5Da0b8a6eb6c555B0fD1a2b9c3d",
    "nonce": "1"
  },
  "signature": "0x..."
}
```

**Response**:
```json
{
  "intentHash": "0xabcd...",
  "biddingWindowMs": 3000,
  "expiresAt": "2023-12-30T20:00:00.000Z",
  "status": "success"
}
```

**Status Codes**:
- `200 OK`: Intent created successfully
- `400 Bad Request`: Invalid intent data
- `429 Too Many Requests`: Rate limit exceeded

---

### Get Intent

Retrieve intent details by hash.

**Endpoint**: `GET /api/intents/:hash`

**Response**:
```json
{
  "intent": {
    "tokenIn": "0xA0b86a33E6417aE5b7cf4e3476BB981a3b7f2cFB",
    "tokenOut": "0x74b7F16337b8972027F6196A17a631aC6dE26d22",
    "amountIn": "1000000000000000000",
    "maxSlippageBps": 50,
    "deadline": "1703980800",
    "chainId": "196",
    "receiver": "0x742C1B41e6E8e5Da0b8a6eb6c555B0fD1a2b9c3d",
    "nonce": "1"
  },
  "status": "BIDDING",
  "createdAt": "2023-12-30T19:59:00.000Z",
  "expiresAt": "2023-12-30T20:00:00.000Z",
  "totalBids": 3
}
```

## Bid Endpoints

### Submit Bid

Submit a solver bid for an intent.

**Endpoint**: `POST /api/bids`

**Headers**:
```
X-Solver-Id: 0x742C1B41e6E8e5Da0b8a6eb6c555B0fD1a2b9c3d
X-Solver-Signature: 0x...
```

**Request Body**:
```json
{
  "intentHash": "0xabcd...",
  "quoteOut": "990000000000000000",
  "solverFeeBps": 10,
  "calldataHint": "0x...",
  "ttlMs": 3000,
  "solverSig": "0x..."
}
```

**Response**:
```json
{
  "accepted": true,
  "rank": 1,
  "bidId": "bid_123"
}
```

---

### Get Best Bid

Get the current best bid for an intent.

**Endpoint**: `GET /api/intents/:hash/bestBid`

**Response**:
```json
{
  "bid": {
    "solver": "0x742C1B41e6E8e5Da0b8a6eb6c555B0fD1a2b9c3d",
    "quoteOut": "990000000000000000",
    "solverFeeBps": 10,
    "calldataHint": "0x..."
  },
  "totalBids": 3,
  "windowClosesAt": "2023-12-30T20:00:03.000Z",
  "score": 98.5,
  "improvement": "15"
}
```

## WebSocket Events

Connect to `ws://localhost:3002/stream` for real-time updates.

### Intent Created
```json
{
  "type": "IntentCreated",
  "data": {
    "intentHash": "0xabcd...",
    "intent": {
      "tokenIn": "0xA0b86a33E6417aE5b7cf4e3476BB981a3b7f2cFB",
      "tokenOut": "0x74b7F16337b8972027F6196A17a631aC6dE26d22",
      "amountIn": "1000000000000000000",
      "maxSlippageBps": 50,
      "deadline": "1703980800",
      "receiver": "0x742C1B41e6E8e5Da0b8a6eb6c555B0fD1a2b9c3d"
    },
    "biddingWindowMs": 3000,
    "createdAt": "2023-12-30T19:59:00.000Z"
  }
}
```

### Best Bid Updated
```json
{
  "type": "BestBidUpdated",
  "data": {
    "intentHash": "0xabcd...",
    "bestBid": {
      "solver": "0x742C1B41e6E8e5Da0b8a6eb6c555B0fD1a2b9c3d",
      "quoteOut": "990000000000000000",
      "solverFeeBps": 10,
      "calldataHint": "0x..."
    },
    "score": 98.5,
    "improvement": "15"
  }
}
```

### Intent Filled
```json
{
  "type": "IntentFilled",
  "data": {
    "intentHash": "0xabcd...",
    "txHash": "0xdef456...",
    "amountOut": "990000000000000000",
    "solverFeePaid": "9900000000000000",
    "filledAt": "2023-12-30T20:00:05.000Z"
  }
}
```

## Health Check

### System Health

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2023-12-30T19:59:00.000Z",
  "uptime": 86400,
  "version": "0.1.0",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "websocket": "healthy"
  },
  "metrics": {
    "totalIntents": 1250,
    "totalBids": 4750,
    "activeConnections": 15,
    "avgResponseTime": 150
  }
}
```

## Error Responses

All error responses follow this format:

```json
{
  "status": "error",
  "message": "Detailed error message",
  "code": "ERROR_CODE",
  "timestamp": "2023-12-30T19:59:00.000Z",
  "validationErrors": [
    {
      "field": "intent.amountIn",
      "message": "Amount must be greater than 0",
      "value": "0"
    }
  ]
}
```

## Rate Limits

- **General API**: 100 requests per 15 minutes per IP
- **Intent Submission**: 10 requests per minute per user
- **Bid Submission**: 50 requests per second per solver

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1703980800
```

## SDK Usage

For TypeScript/JavaScript applications:

```typescript
import { SolverSDK } from '@intendly/solver-sdk';

const sdk = new SolverSDK({
  coordinatorUrl: 'https://api.intendly.xyz',
  wsUrl: 'wss://ws.intendly.xyz',
  solverPrivateKey: process.env.SOLVER_PRIVATE_KEY,
  chainId: 196,
});

// Subscribe to intents
sdk.subscribeToIntents(async (intent) => {
  // Your solver logic here
  return {
    quoteOut: '990000000000000000',
    solverFeeBps: 10,
    calldataHint: '0x...',
    ttlMs: 3000,
  };
});
```

---

*This API documentation is auto-generated from the OpenAPI specification.*