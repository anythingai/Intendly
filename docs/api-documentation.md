# Intent-Based Trading Aggregator - API Documentation

Complete REST API and WebSocket documentation for developers integrating with the Intent-Based Trading Aggregator.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URLs](#base-urls)
- [REST API](#rest-api)
- [WebSocket API](#websocket-api)
- [SDK Integration](#sdk-integration)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)
- [Examples](#examples)

## Overview

The Intent-Based Trading Aggregator provides two main APIs:

1. **REST API**: For creating intents, querying data, and managing solver operations
2. **WebSocket API**: For real-time updates on intent status, solver bids, and market data

### API Versions

- **Current Version**: `v1`
- **Base Path**: `/api/v1`
- **Content Type**: `application/json`

## Authentication

### API Key Authentication

For solver operations and enhanced rate limits:

```http
Authorization: Bearer <your-api-key>
```

### Wallet Signature Authentication

For user operations:

```http
X-Wallet-Address: 0x...
X-Signature: 0x...
X-Message: <signed-message>
```

### Public Endpoints

Many endpoints are public and don't require authentication:
- Market data
- Intent status queries
- Health checks

## Base URLs

| Environment | REST API | WebSocket |
|-------------|----------|-----------|
| **Production** | `https://api.intendly.xyz/api/v1` | `wss://api.intendly.xyz/ws` |
| **Staging** | `https://api-staging.intendly.xyz/api/v1` | `wss://api-staging.intendly.xyz/ws` |
| **Local** | `http://localhost:3001/api/v1` | `ws://localhost:3002/ws` |

## REST API

### Health and Status

#### GET `/health`

Check API health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "components": {
    "database": "healthy",
    "redis": "healthy",
    "blockchain": "healthy"
  }
}
```

#### GET `/status`

Get system status and metrics.

**Response:**
```json
{
  "chainId": 196,
  "blockNumber": 1234567,
  "gasPrice": "20000000000",
  "activeSolvers": 15,
  "totalIntents": 50234,
  "totalVolume": "12345678.90"
}
```

### Intents

#### POST `/intents`

Create a new intent.

**Request Body:**
```json
{
  "tokenIn": "0xA0b86a33E6441539b6c0D4f5F17bF5d9c2d8E8a9",
  "tokenOut": "0xB5D85CBf7cb3EE0D56b3B2f8F9c3e2A1B2c3D4e5",
  "amountIn": "1000000000000000000",
  "receiver": "0xUser123...",
  "maxSlippageBps": 50,
  "deadline": 1705320600,
  "nonce": 1,
  "signature": "0x...",
  "chainId": 196
}
```

**Response:**
```json
{
  "intentId": "intent_1705317000_0x123...",
  "status": "broadcasted",
  "createdAt": "2024-01-15T10:30:00Z",
  "expiresAt": "2024-01-15T10:50:00Z",
  "broadcastTx": "0xabc123..."
}
```

#### GET `/intents/{intentId}`

Get intent details and status.

**Path Parameters:**
- `intentId` (string): Unique intent identifier

**Response:**
```json
{
  "intentId": "intent_1705317000_0x123...",
  "status": "settled",
  "intent": {
    "tokenIn": "0xA0b86a33E6441539b6c0D4f5F17bF5d9c2d8E8a9",
    "tokenOut": "0xB5D85CBf7cb3EE0D56b3B2f8F9c3e2A1B2c3D4e5",
    "amountIn": "1000000000000000000",
    "receiver": "0xUser123...",
    "maxSlippageBps": 50,
    "deadline": 1705320600
  },
  "settlement": {
    "solver": "0xSolver123...",
    "amountOut": "599800000000000000",
    "solverFee": "1200000000000000",
    "txHash": "0xdef456...",
    "blockNumber": 1234568,
    "gasUsed": 150000
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "settledAt": "2024-01-15T10:30:45Z"
}
```

#### GET `/intents`

List intents with filtering and pagination.

**Query Parameters:**
- `user` (string): Filter by user address
- `status` (string): Filter by status (`broadcasted`, `bidding`, `settling`, `settled`, `expired`, `failed`)
- `tokenIn` (string): Filter by input token
- `tokenOut` (string): Filter by output token
- `limit` (number): Results per page (default: 20, max: 100)
- `offset` (number): Pagination offset
- `sortBy` (string): Sort field (`createdAt`, `settledAt`, `amountIn`)
- `sortOrder` (string): Sort order (`asc`, `desc`)

**Response:**
```json
{
  "intents": [
    {
      "intentId": "intent_1705317000_0x123...",
      "status": "settled",
      "tokenIn": "0xA0b86a33E6441539b6c0D4f5F17bF5d9c2d8E8a9",
      "tokenOut": "0xB5D85CBf7cb3EE0D56b3B2f8F9c3e2A1B2c3D4e5",
      "amountIn": "1000000000000000000",
      "amountOut": "599800000000000000",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Solver Operations

#### POST `/solvers/register`

Register as a solver (requires authentication).

**Request Body:**
```json
{
  "address": "0xSolver123...",
  "name": "My Solver",
  "description": "High-performance solver for optimal execution",
  "website": "https://mysolver.com",
  "contact": "team@mysolver.com"
}
```

**Response:**
```json
{
  "solverId": "solver_0xSolver123...",
  "status": "registered",
  "apiKey": "sk_live_...",
  "registeredAt": "2024-01-15T10:30:00Z"
}
```

#### POST `/solvers/{solverId}/bids`

Submit a bid for an intent (requires solver authentication).

**Path Parameters:**
- `solverId` (string): Solver identifier

**Request Body:**
```json
{
  "intentId": "intent_1705317000_0x123...",
  "quoteOut": "599800000000000000",
  "solverFeeBps": 20,
  "signature": "0x...",
  "calldata": "0x...",
  "gasEstimate": 150000
}
```

**Response:**
```json
{
  "bidId": "bid_1705317030_0x456...",
  "status": "submitted",
  "submittedAt": "2024-01-15T10:30:30Z"
}
```

#### GET `/solvers/{solverId}/stats`

Get solver performance statistics.

**Response:**
```json
{
  "solverId": "solver_0xSolver123...",
  "stats": {
    "totalBids": 1250,
    "wonBids": 890,
    "winRate": 0.712,
    "totalVolume": "5678901.23",
    "avgExecutionTime": 25.5,
    "successRate": 0.998,
    "reputation": 0.95
  },
  "period": "30d"
}
```

### Market Data

#### GET `/tokens`

Get supported tokens list.

**Response:**
```json
{
  "tokens": [
    {
      "address": "0xA0b86a33E6441539b6c0D4f5F17bF5d9c2d8E8a9",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "logoURI": "https://tokens.intendly.xyz/usdc.png",
      "verified": true
    }
  ]
}
```

#### GET `/tokens/{tokenAddress}/price`

Get current token price.

**Path Parameters:**
- `tokenAddress` (string): Token contract address

**Response:**
```json
{
  "address": "0xA0b86a33E6441539b6c0D4f5F17bF5d9c2d8E8a9",
  "symbol": "USDC",
  "priceUsd": "1.0001",
  "priceOkb": "0.000024",
  "change24h": 0.0001,
  "volume24h": "12345678.90",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

#### GET `/pairs/{tokenIn}/{tokenOut}/quote`

Get a quote for a token pair.

**Path Parameters:**
- `tokenIn` (string): Input token address
- `tokenOut` (string): Output token address

**Query Parameters:**
- `amountIn` (string): Input amount in wei
- `slippageBps` (number): Maximum slippage in basis points

**Response:**
```json
{
  "tokenIn": "0xA0b86a33E6441539b6c0D4f5F17bF5d9c2d8E8a9",
  "tokenOut": "0xB5D85CBf7cb3EE0D56b3B2f8F9c3e2A1B2c3D4e5",
  "amountIn": "1000000000000000000",
  "amountOut": "599800000000000000",
  "priceImpact": "0.15",
  "route": [
    {
      "protocol": "UniswapV3",
      "pool": "0xPool123...",
      "fee": 3000
    }
  ],
  "gasEstimate": 150000,
  "validUntil": "2024-01-15T10:35:00Z"
}
```

### Analytics

#### GET `/analytics/volume`

Get trading volume analytics.

**Query Parameters:**
- `period` (string): Time period (`1h`, `24h`, `7d`, `30d`)
- `tokenAddress` (string, optional): Filter by token

**Response:**
```json
{
  "period": "24h",
  "totalVolume": "12345678.90",
  "totalTrades": 1250,
  "avgTradeSize": "9876.54",
  "topTokens": [
    {
      "address": "0xA0b86a33E6441539b6c0D4f5F17bF5d9c2d8E8a9",
      "symbol": "USDC",
      "volume": "5678901.23",
      "trades": 567
    }
  ]
}
```

## WebSocket API

### Connection

Connect to the WebSocket endpoint:

```javascript
const ws = new WebSocket('wss://api.intendly.xyz/ws');
```

### Message Format

All messages follow this format:

```json
{
  "type": "message_type",
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Subscription Management

#### Subscribe to Intent Updates

```json
{
  "type": "subscribe",
  "channel": "intent_updates",
  "params": {
    "intentId": "intent_1705317000_0x123..."
  }
}
```

#### Subscribe to Solver Bids

```json
{
  "type": "subscribe",
  "channel": "solver_bids",
  "params": {
    "intentId": "intent_1705317000_0x123..."
  }
}
```

#### Subscribe to Market Data

```json
{
  "type": "subscribe",
  "channel": "market_data",
  "params": {
    "pairs": ["USDC/ETH", "ETH/OKB"]
  }
}
```

### Message Types

#### Intent Status Update

```json
{
  "type": "intent_status",
  "data": {
    "intentId": "intent_1705317000_0x123...",
    "status": "settling",
    "previousStatus": "bidding",
    "timestamp": "2024-01-15T10:30:30Z"
  }
}
```

#### New Solver Bid

```json
{
  "type": "solver_bid",
  "data": {
    "intentId": "intent_1705317000_0x123...",
    "bidId": "bid_1705317030_0x456...",
    "solver": "0xSolver123...",
    "quoteOut": "599800000000000000",
    "solverFeeBps": 20,
    "timestamp": "2024-01-15T10:30:30Z"
  }
}
```

#### Settlement Notification

```json
{
  "type": "settlement",
  "data": {
    "intentId": "intent_1705317000_0x123...",
    "txHash": "0xdef456...",
    "solver": "0xSolver123...",
    "amountOut": "599800000000000000",
    "gasUsed": 150000,
    "timestamp": "2024-01-15T10:30:45Z"
  }
}
```

#### Price Update

```json
{
  "type": "price_update",
  "data": {
    "pair": "USDC/ETH",
    "price": "0.0006",
    "change24h": 0.025,
    "volume24h": "12345678.90",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error Messages

```json
{
  "type": "error",
  "data": {
    "code": "INVALID_SUBSCRIPTION",
    "message": "Invalid channel or parameters",
    "details": {
      "channel": "invalid_channel"
    }
  }
}
```

## SDK Integration

### JavaScript/TypeScript SDK

Install the official SDK:

```bash
npm install @intendly/sdk
```

Basic usage:

```typescript
import { IntendlySDK } from '@intendly/sdk';

const sdk = new IntendlySDK({
  chainId: 196,
  apiUrl: 'https://api.intendly.xyz',
  wsUrl: 'wss://api.intendly.xyz/ws'
});

// Create an intent
const intent = await sdk.createIntent({
  tokenIn: '0xA0b86a33E6441539b6c0D4f5F17bF5d9c2d8E8a9',
  tokenOut: '0xB5D85CBf7cb3EE0D56b3B2f8F9c3e2A1B2c3D4e5',
  amountIn: '1000000000000000000',
  maxSlippageBps: 50,
  deadline: Math.floor(Date.now() / 1000) + 1200 // 20 minutes
});

// Subscribe to updates
sdk.subscribeToIntent(intent.intentId, (update) => {
  console.log('Intent update:', update);
});
```

### Python SDK

```python
from intendly import IntendlyClient

client = IntendlyClient(
    chain_id=196,
    api_url='https://api.intendly.xyz'
)

# Get quote
quote = client.get_quote(
    token_in='0xA0b86a33E6441539b6c0D4f5F17bF5d9c2d8E8a9',
    token_out='0xB5D85CBf7cb3EE0D56b3B2f8F9c3e2A1B2c3D4e5',
    amount_in='1000000000000000000'
)
```

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `200` | OK | Request successful |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid request parameters |
| `401` | Unauthorized | Authentication required |
| `403` | Forbidden | Access denied |
| `404` | Not Found | Resource not found |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |
| `503` | Service Unavailable | Temporary service unavailability |

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_INTENT",
    "message": "Invalid intent parameters",
    "details": {
      "field": "amountIn",
      "reason": "Amount must be greater than 0"
    }
  },
  "requestId": "req_1705317000_abc123"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_INTENT` | Intent parameters are invalid |
| `INSUFFICIENT_BALANCE` | User has insufficient token balance |
| `UNSUPPORTED_TOKEN` | Token is not supported |
| `DEADLINE_EXCEEDED` | Intent deadline has passed |
| `SLIPPAGE_EXCEEDED` | Price moved beyond acceptable slippage |
| `NO_LIQUIDITY` | Insufficient liquidity for trade |
| `SOLVER_ERROR` | Solver execution failed |
| `SIGNATURE_INVALID` | Invalid signature provided |
| `RATE_LIMITED` | Rate limit exceeded |

## Rate Limits

### Default Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| **Public API** | 100 requests | 1 minute |
| **Authenticated** | 1000 requests | 1 minute |
| **Solver API** | 10000 requests | 1 minute |
| **WebSocket** | 1000 messages | 1 minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705317060
```

### Handling Rate Limits

When rate limited, you'll receive a `429` status code:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 100,
      "window": "1m",
      "resetAt": "2024-01-15T10:31:00Z"
    }
  }
}
```

## Examples

### Complete Intent Flow

```javascript
// 1. Create an intent
const intentResponse = await fetch('https://api.intendly.xyz/api/v1/intents', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Wallet-Address': userAddress,
    'X-Signature': signature
  },
  body: JSON.stringify({
    tokenIn: '0xA0b86a33E6441539b6c0D4f5F17bF5d9c2d8E8a9',
    tokenOut: '0xB5D85CBf7cb3EE0D56b3B2f8F9c3e2A1B2c3D4e5',
    amountIn: '1000000000000000000',
    receiver: userAddress,
    maxSlippageBps: 50,
    deadline: Math.floor(Date.now() / 1000) + 1200,
    nonce: 1,
    signature: intentSignature,
    chainId: 196
  })
});

const { intentId } = await intentResponse.json();

// 2. Subscribe to WebSocket updates
const ws = new WebSocket('wss://api.intendly.xyz/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'intent_updates',
    params: { intentId }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'intent_status':
      console.log('Status update:', message.data.status);
      break;
    case 'solver_bid':
      console.log('New bid:', message.data);
      break;
    case 'settlement':
      console.log('Settlement complete:', message.data);
      break;
  }
};

// 3. Poll for final status
const checkStatus = async () => {
  const response = await fetch(`https://api.intendly.xyz/api/v1/intents/${intentId}`);
  const intent = await response.json();
  
  if (intent.status === 'settled') {
    console.log('Intent settled successfully!');
    console.log('Transaction:', intent.settlement.txHash);
  }
};
```

### Solver Integration

```javascript
// Register as a solver
const registerResponse = await fetch('https://api.intendly.xyz/api/v1/solvers/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + authToken
  },
  body: JSON.stringify({
    address: solverAddress,
    name: 'My Solver',
    description: 'High-performance solver'
  })
});

const { apiKey } = await registerResponse.json();

// Listen for new intents
const ws = new WebSocket('wss://api.intendly.xyz/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'new_intents',
    params: { solverId: solverAddress }
  }));
};

ws.onmessage = async (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'new_intent') {
    const intent = message.data;
    
    // Calculate optimal route and quote
    const quote = await calculateQuote(intent);
    
    // Submit bid
    await fetch(`https://api.intendly.xyz/api/v1/solvers/${solverAddress}/bids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        intentId: intent.intentId,
        quoteOut: quote.amountOut,
        solverFeeBps: 25,
        signature: bidSignature,
        calldata: executionCalldata,
        gasEstimate: gasEstimate
      })
    });
  }
};
```

## Support

- **Documentation**: [https://docs.intendly.xyz](https://docs.intendly.xyz)
- **Discord**: [https://discord.gg/intendly](https://discord.gg/intendly)
- **GitHub**: [https://github.com/intendly/intent-based-trading-aggregator](https://github.com/intendly/intent-based-trading-aggregator)
- **Email**: developers@intendly.xyz

---

*API Version: 1.0.0 | Last Updated: 2024-01-15*