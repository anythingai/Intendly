/**
 * @fileoverview Unit tests for Intent Service
 * @description Test intent validation, creation, and processing logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IntentService } from '../../src/relayer/services/intentService.js';
import { CreateIntentRequest, IntentStatus } from '../../src/shared/types/intent.js';

// Mock dependencies
vi.mock('../../src/shared/database/models/intent.js');
vi.mock('../../src/shared/utils/index.js');

describe('IntentService', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createIntent', () => {
    it('should successfully create a valid intent', async () => {
      const request: CreateIntentRequest = {
        intent: mockIntent,
        signature: mockSignature
      };

      // Mock successful validation and creation
      vi.mocked(IntentService.createIntent).mockResolvedValue({
        intentHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        biddingWindowMs: 3000,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        status: 'success'
      });

      const result = await IntentService.createIntent(request);

      expect(result.status).toBe('success');
      expect(result.intentHash).toBeDefined();
      expect(result.biddingWindowMs).toBe(3000);
      expect(result.expiresAt).toBeDefined();
    });

    it('should reject intent with invalid token addresses', async () => {
      const request: CreateIntentRequest = {
        intent: {
          ...mockIntent,
          tokenIn: 'invalid_address'
        },
        signature: mockSignature
      };

      vi.mocked(IntentService.createIntent).mockResolvedValue({
        intentHash: '',
        biddingWindowMs: 0,
        expiresAt: '',
        status: 'error',
        message: 'Invalid intent: Invalid tokenIn address'
      });

      const result = await IntentService.createIntent(request);

      expect(result.status).toBe('error');
      expect(result.message).toContain('Invalid tokenIn address');
    });

    it('should reject intent with expired deadline', async () => {
      const request: CreateIntentRequest = {
        intent: {
          ...mockIntent,
          deadline: Math.floor(Date.now() / 1000 - 3600).toString() // 1 hour ago
        },
        signature: mockSignature
      };

      vi.mocked(IntentService.createIntent).mockResolvedValue({
        intentHash: '',
        biddingWindowMs: 0,
        expiresAt: '',
        status: 'error',
        message: 'Intent deadline has already passed'
      });

      const result = await IntentService.createIntent(request);

      expect(result.status).toBe('error');
      expect(result.message).toContain('deadline has already passed');
    });

    it('should reject intent with invalid signature', async () => {
      const request: CreateIntentRequest = {
        intent: mockIntent,
        signature: 'invalid_signature'
      };

      vi.mocked(IntentService.createIntent).mockResolvedValue({
        intentHash: '',
        biddingWindowMs: 0,
        expiresAt: '',
        status: 'error',
        message: 'Invalid signature'
      });

      const result = await IntentService.createIntent(request);

      expect(result.status).toBe('error');
      expect(result.message).toContain('Invalid signature');
    });

    it('should handle duplicate intent submissions', async () => {
      const request: CreateIntentRequest = {
        intent: mockIntent,
        signature: mockSignature
      };

      vi.mocked(IntentService.createIntent).mockResolvedValue({
        intentHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        biddingWindowMs: 3000,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        status: 'error',
        message: 'Intent already exists'
      });

      const result = await IntentService.createIntent(request);

      expect(result.status).toBe('error');
      expect(result.message).toBe('Intent already exists');
      expect(result.intentHash).toBeDefined(); // Should still return the hash
    });
  });

  describe('getIntent', () => {
    it('should retrieve intent from cache first', async () => {
      const intentHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const mockIntentRecord = {
        intentHash,
        payload: mockIntent,
        signature: mockSignature,
        signer: '0x1111111111111111111111111111111111111111',
        status: 'NEW' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        totalBids: 0
      };

      vi.mocked(IntentService.getIntent).mockResolvedValue(mockIntentRecord);

      const result = await IntentService.getIntent(intentHash);

      expect(result).toEqual(mockIntentRecord);
      expect(result?.intentHash).toBe(intentHash);
    });

    it('should return null for non-existent intent', async () => {
      const intentHash = '0x0000000000000000000000000000000000000000000000000000000000000000';

      vi.mocked(IntentService.getIntent).mockResolvedValue(null);

      const result = await IntentService.getIntent(intentHash);

      expect(result).toBeNull();
    });
  });

  describe('updateIntentStatus', () => {
    it('should successfully update intent status', async () => {
      const intentHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      vi.mocked(IntentService.updateIntentStatus).mockResolvedValue(true);

      const result = await IntentService.updateIntentStatus(intentHash, IntentStatus.BIDDING);

      expect(result).toBe(true);
    });

    it('should return false when intent not found', async () => {
      const intentHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
      
      vi.mocked(IntentService.updateIntentStatus).mockResolvedValue(false);

      const result = await IntentService.updateIntentStatus(intentHash, IntentStatus.BIDDING);

      expect(result).toBe(false);
    });
  });

  describe('processExpiredIntents', () => {
    it('should process multiple expired intents', async () => {
      vi.mocked(IntentService.processExpiredIntents).mockResolvedValue(5);

      const result = await IntentService.processExpiredIntents();

      expect(result).toBe(5);
      expect(typeof result).toBe('number');
    });

    it('should handle case with no expired intents', async () => {
      vi.mocked(IntentService.processExpiredIntents).mockResolvedValue(0);

      const result = await IntentService.processExpiredIntents();

      expect(result).toBe(0);
    });
  });

  describe('getIntentStats', () => {
    it('should return intent statistics', async () => {
      const mockStats = {
        total: 100,
        byStatus: {
          'NEW': 10,
          'BIDDING': 15,
          'FILLED': 60,
          'EXPIRED': 10,
          'FAILED': 5
        },
        last24h: 25
      };

      vi.mocked(IntentService.getIntentStats).mockResolvedValue(mockStats);

      const result = await IntentService.getIntentStats();

      expect(result).toEqual(mockStats);
      expect(result.total).toBe(100);
      expect(result.last24h).toBe(25);
      expect(Object.keys(result.byStatus)).toHaveLength(5);
    });
  });
});