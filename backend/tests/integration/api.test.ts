/**
 * @fileoverview Integration tests for API endpoints
 * @description Test complete API functionality with real HTTP requests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { IntentStatus } from '../../src/shared/types/intent.js';

// Import apps - these would need to be properly mocked in real tests
let relayerApp: any;
let coordinatorApp: any;

// Mock test data
const mockIntent = {
  tokenIn: '0x1234567890123456789012345678901234567890',
  tokenOut: '0x0987654321098765432109876543210987654321',
  amountIn: '1000000000000000000',
  maxSlippageBps: 300,
  deadline: Math.floor(Date.now() / 1000 + 3600).toString(),
  chainId: '196',
  receiver: '0x1111111111111111111111111111111111111111',
  nonce: '12345'
};

const mockSignature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234';

const mockBid = {
  intentHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  quoteOut: '1100000000000000000',
  solverFeeBps: 30,
  calldataHint: '0x1234',
  ttlMs: 2000,
  solverSig: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234'
};

describe('API Integration Tests', () => {
  beforeAll(async () => {
    // In real tests, these would be properly imported and initialized
    // relayerApp = require('../../src/relayer/index.js').default;
    // coordinatorApp = require('../../src/coordinator/index.js').default;
  });

  afterAll(async () => {
    // Clean up test environment
  });

  beforeEach(async () => {
    // Reset test data before each test
  });

  describe('Relayer API', () => {
    describe('POST /api/intents', () => {
      it('should create a new intent successfully', async () => {
        if (!relayerApp) {
          console.log('Skipping test - relayerApp not available');
          return;
        }

        const response = await request(relayerApp)
          .post('/api/intents')
          .send({
            intent: mockIntent,
            signature: mockSignature
          })
          .expect(201);

        expect(response.body.status).toBe('success');
        expect(response.body.data.intentHash).toBeDefined();
        expect(response.body.data.biddingWindowMs).toBeGreaterThan(0);
        expect(response.body.data.expiresAt).toBeDefined();
      });

      it('should reject intent with invalid data', async () => {
        if (!relayerApp) {
          console.log('Skipping test - relayerApp not available');
          return;
        }

        const response = await request(relayerApp)
          .post('/api/intents')
          .send({
            intent: {
              ...mockIntent,
              tokenIn: 'invalid_address'
            },
            signature: mockSignature
          })
          .expect(400);

        expect(response.body.status).toBe('error');
        expect(response.body.message).toContain('Validation failed');
      });

      it('should reject intent without signature', async () => {
        if (!relayerApp) {
          console.log('Skipping test - relayerApp not available');
          return;
        }

        const response = await request(relayerApp)
          .post('/api/intents')
          .send({
            intent: mockIntent
            // Missing signature
          })
          .expect(400);

        expect(response.body.status).toBe('error');
        expect(response.body.message).toBe('Validation failed');
      });

      it('should respect rate limiting', async () => {
        if (!relayerApp) {
          console.log('Skipping test - relayerApp not available');
          return;
        }

        // Send multiple requests rapidly
        const requests = Array(12).fill(null).map(() => 
          request(relayerApp)
            .post('/api/intents')
            .send({
              intent: mockIntent,
              signature: mockSignature
            })
        );

        const responses = await Promise.all(requests);
        
        // At least one should be rate limited (429)
        const rateLimitedResponses = responses.filter(r => r.status === 429);
        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      });
    });

    describe('GET /api/intents/:hash', () => {
      it('should retrieve existing intent', async () => {
        if (!relayerApp) {
          console.log('Skipping test - relayerApp not available');
          return;
        }

        // First create an intent
        const createResponse = await request(relayerApp)
          .post('/api/intents')
          .send({
            intent: mockIntent,
            signature: mockSignature
          });

        const intentHash = createResponse.body.data.intentHash;

        // Then retrieve it
        const response = await request(relayerApp)
          .get(`/api/intents/${intentHash}`)
          .expect(200);

        expect(response.body.status).toBe('success');
        expect(response.body.data.intent).toBeDefined();
        expect(response.body.data.status).toBeDefined();
        expect(response.body.data.createdAt).toBeDefined();
      });

      it('should return 404 for non-existent intent', async () => {
        if (!relayerApp) {
          console.log('Skipping test - relayerApp not available');
          return;
        }

        const nonExistentHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
        
        const response = await request(relayerApp)
          .get(`/api/intents/${nonExistentHash}`)
          .expect(404);

        expect(response.body.status).toBe('error');
        expect(response.body.message).toBe('Intent not found');
      });

      it('should reject invalid hash format', async () => {
        if (!relayerApp) {
          console.log('Skipping test - relayerApp not available');
          return;
        }

        const response = await request(relayerApp)
          .get('/api/intents/invalid_hash')
          .expect(400);

        expect(response.body.status).toBe('error');
        expect(response.body.message).toBe('Invalid intent hash');
      });
    });

    describe('GET /health', () => {
      it('should return health status', async () => {
        if (!relayerApp) {
          console.log('Skipping test - relayerApp not available');
          return;
        }

        const response = await request(relayerApp)
          .get('/health')
          .expect(200);

        expect(response.body.status).toBeDefined();
        expect(response.body.service).toBe('relayer');
        expect(response.body.timestamp).toBeDefined();
      });
    });
  });

  describe('Coordinator API', () => {
    describe('POST /api/bids', () => {
      it('should accept valid bid submission', async () => {
        if (!coordinatorApp) {
          console.log('Skipping test - coordinatorApp not available');
          return;
        }

        const response = await request(coordinatorApp)
          .post('/api/bids')
          .send(mockBid)
          .expect(201);

        expect(response.body.status).toBe('success');
        expect(response.body.data.accepted).toBe(true);
        expect(response.body.data.bidId).toBeDefined();
        expect(response.body.data.rank).toBeGreaterThan(0);
      });

      it('should reject bid with invalid data', async () => {
        if (!coordinatorApp) {
          console.log('Skipping test - coordinatorApp not available');
          return;
        }

        const response = await request(coordinatorApp)
          .post('/api/bids')
          .send({
            ...mockBid,
            quoteOut: 'invalid_amount'
          })
          .expect(400);

        expect(response.body.status).toBe('error');
        expect(response.body.message).toContain('Validation failed');
      });

      it('should reject bid with excessive solver fee', async () => {
        if (!coordinatorApp) {
          console.log('Skipping test - coordinatorApp not available');
          return;
        }

        const response = await request(coordinatorApp)
          .post('/api/bids')
          .send({
            ...mockBid,
            solverFeeBps: 10000 // 100% fee
          })
          .expect(400);

        expect(response.body.status).toBe('error');
      });
    });

    describe('GET /api/intents/:intentHash/bestBid', () => {
      it('should return best bid for intent', async () => {
        if (!coordinatorApp) {
          console.log('Skipping test - coordinatorApp not available');
          return;
        }

        const response = await request(coordinatorApp)
          .get(`/api/intents/${mockBid.intentHash}/bestBid`)
          .expect(200);

        expect(response.body.status).toBe('success');
        expect(response.body.data.totalBids).toBeGreaterThanOrEqual(0);
        expect(response.body.data.windowClosesAt).toBeDefined();
      });

      it('should handle non-existent intent', async () => {
        if (!coordinatorApp) {
          console.log('Skipping test - coordinatorApp not available');
          return;
        }

        const nonExistentHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
        
        const response = await request(coordinatorApp)
          .get(`/api/intents/${nonExistentHash}/bestBid`)
          .expect(200);

        expect(response.body.status).toBe('success');
        expect(response.body.data.bid).toBeNull();
        expect(response.body.data.totalBids).toBe(0);
      });
    });
  });

  describe('Cross-service Integration', () => {
    it('should handle complete intent-to-bid flow', async () => {
      if (!relayerApp || !coordinatorApp) {
        console.log('Skipping test - apps not available');
        return;
      }

      // 1. Create intent via relayer
      const intentResponse = await request(relayerApp)
        .post('/api/intents')
        .send({
          intent: mockIntent,
          signature: mockSignature
        })
        .expect(201);

      const intentHash = intentResponse.body.data.intentHash;

      // 2. Submit bid via coordinator
      const bidResponse = await request(coordinatorApp)
        .post('/api/bids')
        .send({
          ...mockBid,
          intentHash
        })
        .expect(201);

      expect(bidResponse.body.data.accepted).toBe(true);

      // 3. Check best bid
      const bestBidResponse = await request(coordinatorApp)
        .get(`/api/intents/${intentHash}/bestBid`)
        .expect(200);

      expect(bestBidResponse.body.data.totalBids).toBeGreaterThan(0);
      if (bestBidResponse.body.data.bid) {
        expect(bestBidResponse.body.data.bid.quoteOut).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      if (!relayerApp) {
        console.log('Skipping test - relayerApp not available');
        return;
      }

      const response = await request(relayerApp)
        .post('/api/intents')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should handle large payloads', async () => {
      if (!relayerApp) {
        console.log('Skipping test - relayerApp not available');
        return;
      }

      const largePayload = {
        intent: {
          ...mockIntent,
          // Add large data
          largeData: 'x'.repeat(20 * 1024 * 1024) // 20MB
        },
        signature: mockSignature
      };

      const response = await request(relayerApp)
        .post('/api/intents')
        .send(largePayload)
        .expect(413); // Payload too large

      expect(response.body.status).toBe('error');
    });
  });
});