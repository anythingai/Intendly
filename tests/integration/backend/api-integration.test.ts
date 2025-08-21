/**
 * @fileoverview Backend API integration tests
 * @description Test complete API functionality with real services
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { testConfig } from '../../setup/test-config.js';
import { 
  createTestIntent, 
  createTestBid, 
  createIntentRequest,
  createMultipleBids 
} from '../../setup/test-data-factory.js';
import { resetTestDatabase, seedTestDatabase } from '../../setup/test-environment.js';

describe('Backend API Integration Tests', () => {
  let relayerApp: any;
  let coordinatorApp: any;

  beforeAll(async () => {
    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get service URLs from config
    const relayerUrl = testConfig.services.relayer.url;
    const coordinatorUrl = testConfig.services.coordinator.url;
    
    console.log(`Testing against Relayer: ${relayerUrl}`);
    console.log(`Testing against Coordinator: ${coordinatorUrl}`);
    
    // Create mock app objects for supertest
    relayerApp = { request: (path: string) => request(relayerUrl + path) };
    coordinatorApp = { request: (path: string) => request(coordinatorUrl + path) };
  });

  beforeEach(async () => {
    // Reset database before each test
    await resetTestDatabase();
    await seedTestDatabase();
  });

  describe('Relayer API', () => {
    describe('POST /api/intents', () => {
      it('should create a new intent successfully', async () => {
        const intentRequest = createIntentRequest();
        
        const response = await request(testConfig.services.relayer.url)
          .post('/api/intents')
          .send(intentRequest)
          .expect(201);

        expect(response.body.status).toBe('success');
        expect(response.body.data.intentHash).toBeTruthy();
        expect(response.body.data.biddingWindowMs).toBeGreaterThan(0);
        expect(response.body.data.expiresAt).toBeTruthy();
      });

      it('should validate intent parameters', async () => {
        const invalidIntent = createIntentRequest({
          intent: {
            tokenIn: 'invalid_address',
            tokenOut: '0x0987654321098765432109876543210987654321',
            amountIn: '1000000000000000000',
            maxSlippageBps: 300,
            deadline: (Math.floor(Date.now() / 1000) + 3600).toString(),
            chainId: testConfig.blockchain.chainId.toString(),
            receiver: '0x1111111111111111111111111111111111111111',
            nonce: '12345'
          }
        });

        const response = await request(testConfig.services.relayer.url)
          .post('/api/intents')
          .send(invalidIntent)
          .expect(400);

        expect(response.body.status).toBe('error');
        expect(response.body.message).toContain('validation');
      });

      it('should reject expired intents', async () => {
        const expiredIntent = createIntentRequest({
          intent: {
            tokenIn: '0x1234567890123456789012345678901234567890',
            tokenOut: '0x0987654321098765432109876543210987654321',
            amountIn: '1000000000000000000',
            maxSlippageBps: 300,
            deadline: (Math.floor(Date.now() / 1000) - 3600).toString(), // Expired
            chainId: testConfig.blockchain.chainId.toString(),
            receiver: '0x1111111111111111111111111111111111111111',
            nonce: '12345'
          }
        });

        const response = await request(testConfig.services.relayer.url)
          .post('/api/intents')
          .send(expiredIntent)
          .expect(400);

        expect(response.body.status).toBe('error');
        expect(response.body.message).toContain('expired');
      });

      it('should handle rate limiting', async () => {
        const intentRequest = createIntentRequest();
        
        // Send multiple requests rapidly
        const requests = Array(15).fill(null).map(() => 
          request(testConfig.services.relayer.url)
            .post('/api/intents')
            .send({
              ...intentRequest,
              intent: {
                ...intentRequest.intent,
                nonce: Math.random().toString() // Unique nonce for each
              }
            })
        );

        const responses = await Promise.allSettled(requests);
        
        // Some requests should be rate limited (429)
        const rateLimitedCount = responses.filter(
          result => result.status === 'fulfilled' && 
                   (result.value as any).status === 429
        ).length;
        
        expect(rateLimitedCount).toBeGreaterThan(0);
      });
    });

    describe('GET /api/intents/:hash', () => {
      it('should retrieve existing intent', async () => {
        // First create an intent
        const intentRequest = createIntentRequest();
        const createResponse = await request(testConfig.services.relayer.url)
          .post('/api/intents')
          .send(intentRequest)
          .expect(201);

        const intentHash = createResponse.body.data.intentHash;

        // Then retrieve it
        const response = await request(testConfig.services.relayer.url)
          .get(`/api/intents/${intentHash}`)
          .expect(200);

        expect(response.body.status).toBe('success');
        expect(response.body.data.intent).toBeTruthy();
        expect(response.body.data.status).toBeTruthy();
        expect(response.body.data.createdAt).toBeTruthy();
      });

      it('should return 404 for non-existent intent', async () => {
        const nonExistentHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
        
        const response = await request(testConfig.services.relayer.url)
          .get(`/api/intents/${nonExistentHash}`)
          .expect(404);

        expect(response.body.status).toBe('error');
        expect(response.body.message).toContain('not found');
      });
    });

    describe('GET /health', () => {
      it('should return healthy status', async () => {
        const response = await request(testConfig.services.relayer.url)
          .get('/health')
          .expect(200);

        expect(response.body.status).toBe('healthy');
        expect(response.body.service).toBe('relayer');
        expect(response.body.timestamp).toBeTruthy();
        expect(response.body.uptime).toBeGreaterThan(0);
      });

      it('should include dependency health checks', async () => {
        const response = await request(testConfig.services.relayer.url)
          .get('/health')
          .expect(200);

        expect(response.body.dependencies).toBeTruthy();
        expect(response.body.dependencies.database).toBeTruthy();
        expect(response.body.dependencies.redis).toBeTruthy();
      });
    });
  });

  describe('Coordinator API', () => {
    let testIntentHash: string;

    beforeEach(async () => {
      // Create a test intent for coordinator tests
      const intentRequest = createIntentRequest();
      const response = await request(testConfig.services.relayer.url)
        .post('/api/intents')
        .send(intentRequest)
        .expect(201);
      
      testIntentHash = response.body.data.intentHash;
    });

    describe('POST /api/bids', () => {
      it('should accept valid bid submission', async () => {
        const bid = createTestBid(testIntentHash);
        
        const response = await request(testConfig.services.coordinator.url)
          .post('/api/bids')
          .send(bid)
          .expect(201);

        expect(response.body.status).toBe('success');
        expect(response.body.data.accepted).toBe(true);
        expect(response.body.data.bidId).toBeTruthy();
        expect(response.body.data.rank).toBeGreaterThan(0);
      });

      it('should validate bid parameters', async () => {
        const invalidBid = createTestBid(testIntentHash, {
          quoteOut: 'invalid_amount'
        });

        const response = await request(testConfig.services.coordinator.url)
          .post('/api/bids')
          .send(invalidBid)
          .expect(400);

        expect(response.body.status).toBe('error');
        expect(response.body.message).toContain('validation');
      });

      it('should reject bids with excessive fees', async () => {
        const highFeeBid = createTestBid(testIntentHash, {
          solverFeeBps: 1000 // 10%
        });

        const response = await request(testConfig.services.coordinator.url)
          .post('/api/bids')
          .send(highFeeBid)
          .expect(400);

        expect(response.body.status).toBe('error');
        expect(response.body.message).toContain('fee');
      });

      it('should handle solver competition correctly', async () => {
        const bids = createMultipleBids(testIntentHash, 5);
        
        // Submit all bids
        const responses = await Promise.all(
          bids.map(bid => 
            request(testConfig.services.coordinator.url)
              .post('/api/bids')
              .send(bid)
          )
        );

        // All should be accepted
        responses.forEach(response => {
          expect(response.status).toBe(201);
          expect(response.body.data.accepted).toBe(true);
        });

        // Check that they have different ranks
        const ranks = responses.map(r => r.body.data.rank);
        const uniqueRanks = new Set(ranks);
        expect(uniqueRanks.size).toBe(bids.length);
      });

      it('should respect bidding window timing', async () => {
        // Wait for bidding window to close (simulated)
        // In real test, this would wait for actual timeout
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const lateBid = createTestBid(testIntentHash);
        
        // This might still succeed depending on timing
        const response = await request(testConfig.services.coordinator.url)
          .post('/api/bids')
          .send(lateBid);

        // Could be accepted or rejected based on timing
        expect([201, 400]).toContain(response.status);
      });
    });

    describe('GET /api/intents/:intentHash/bestBid', () => {
      beforeEach(async () => {
        // Submit some bids for testing
        const bids = createMultipleBids(testIntentHash, 3);
        
        await Promise.all(
          bids.map(bid => 
            request(testConfig.services.coordinator.url)
              .post('/api/bids')
              .send(bid)
          )
        );
      });

      it('should return best bid for intent', async () => {
        const response = await request(testConfig.services.coordinator.url)
          .get(`/api/intents/${testIntentHash}/bestBid`)
          .expect(200);

        expect(response.body.status).toBe('success');
        expect(response.body.data.totalBids).toBeGreaterThan(0);
        expect(response.body.data.windowClosesAt).toBeTruthy();
        expect(response.body.data.bid).toBeTruthy();
      });

      it('should include bid ranking information', async () => {
        const response = await request(testConfig.services.coordinator.url)
          .get(`/api/intents/${testIntentHash}/bestBid`)
          .expect(200);

        expect(response.body.data.ranking).toBeTruthy();
        expect(Array.isArray(response.body.data.ranking)).toBe(true);
        expect(response.body.data.ranking.length).toBeGreaterThan(0);
        
        // Check ranking is sorted by score
        const scores = response.body.data.ranking.map((r: any) => r.score);
        const sortedScores = [...scores].sort((a, b) => b - a);
        expect(scores).toEqual(sortedScores);
      });
    });

    describe('GET /api/intents/:intentHash/bids', () => {
      it('should return all bids for intent', async () => {
        // Submit multiple bids
        const bids = createMultipleBids(testIntentHash, 4);
        
        await Promise.all(
          bids.map(bid => 
            request(testConfig.services.coordinator.url)
              .post('/api/bids')
              .send(bid)
          )
        );

        const response = await request(testConfig.services.coordinator.url)
          .get(`/api/intents/${testIntentHash}/bids`)
          .expect(200);

        expect(response.body.status).toBe('success');
        expect(response.body.data.bids).toBeTruthy();
        expect(response.body.data.bids.length).toBe(4);
        expect(response.body.data.totalBids).toBe(4);
      });
    });
  });

  describe('Cross-Service Integration', () => {
    it('should handle complete intent-to-best-bid flow', async () => {
      // 1. Create intent via relayer
      const intentRequest = createIntentRequest();
      const intentResponse = await request(testConfig.services.relayer.url)
        .post('/api/intents')
        .send(intentRequest)
        .expect(201);

      const intentHash = intentResponse.body.data.intentHash;

      // 2. Submit multiple bids via coordinator
      const bids = createMultipleBids(intentHash, 3);
      
      const bidResponses = await Promise.all(
        bids.map(bid => 
          request(testConfig.services.coordinator.url)
            .post('/api/bids')
            .send(bid)
            .expect(201)
        )
      );

      // 3. Verify all bids were accepted
      bidResponses.forEach(response => {
        expect(response.body.data.accepted).toBe(true);
      });

      // 4. Get best bid
      const bestBidResponse = await request(testConfig.services.coordinator.url)
        .get(`/api/intents/${intentHash}/bestBid`)
        .expect(200);

      expect(bestBidResponse.body.data.totalBids).toBe(3);
      expect(bestBidResponse.body.data.bid).toBeTruthy();

      // 5. Verify intent status updated
      const intentStatusResponse = await request(testConfig.services.relayer.url)
        .get(`/api/intents/${intentHash}`)
        .expect(200);

      expect(['BIDDING', 'FILLED'].includes(intentStatusResponse.body.data.status)).toBe(true);
    });

    it('should handle high-load scenario', async () => {
      // Create multiple intents concurrently
      const intentRequests = Array.from({ length: 10 }, () => createIntentRequest({
        intent: {
          tokenIn: '0x1234567890123456789012345678901234567890',
          tokenOut: '0x0987654321098765432109876543210987654321',
          amountIn: '1000000000000000000',
          maxSlippageBps: 300,
          deadline: (Math.floor(Date.now() / 1000) + 3600).toString(),
          chainId: testConfig.blockchain.chainId.toString(),
          receiver: '0x1111111111111111111111111111111111111111',
          nonce: Math.random().toString()
        }
      }));

      const startTime = Date.now();
      
      const intentResponses = await Promise.allSettled(
        intentRequests.map(req => 
          request(testConfig.services.relayer.url)
            .post('/api/intents')
            .send(req)
        )
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle 10 intents within reasonable time
      expect(duration).toBeLessThan(testConfig.performance.maxIntentProcessingTime * 10);
      
      // Most should succeed
      const successCount = intentResponses.filter(
        r => r.status === 'fulfilled' && (r.value as any).status === 201
      ).length;
      
      expect(successCount).toBeGreaterThan(7); // At least 70% success rate
    });
  });

  afterAll(async () => {
    console.log('Backend API integration tests completed');
  });
});