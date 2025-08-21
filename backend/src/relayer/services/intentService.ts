/**
 * @fileoverview Intent service for validation, storage, and processing
 * @description Handles intent lifecycle management and business logic
 */

import { IntentModel } from '@/database/models/intent.js';
import { Intent, IntentRecord, IntentStatus, CreateIntentRequest, CreateIntentResponse } from '@/types/intent.js';
import { CryptoUtils, redis, relayerLogger as logger } from '@/utils/index.js';
import config from '@/shared/config/index.js';

export interface IntentValidationError {
  field: string;
  message: string;
  code: string;
}

export class IntentService {
  /**
   * Create and process a new intent
   */
  static async createIntent(request: CreateIntentRequest): Promise<CreateIntentResponse> {
    const { intent, signature } = request;
    
    try {
      // 1. Validate intent structure
      const structureValidation = CryptoUtils.validateIntentStructure(intent);
      if (!structureValidation.isValid) {
        logger.warn('Intent structure validation failed', {
          errors: structureValidation.errors,
          intent: intent
        });

        return {
          intentHash: '',
          biddingWindowMs: 0,
          expiresAt: '',
          status: 'error',
          message: `Invalid intent: ${structureValidation.errors.join(', ')}`
        };
      }

      // 2. Generate intent hash
      const intentHash = CryptoUtils.generateIntentHash(intent);

      // 3. Check for duplicate intent
      const existingIntent = await IntentModel.findByHash(intentHash);
      if (existingIntent) {
        logger.warn('Duplicate intent submission', { intentHash });
        return {
          intentHash,
          biddingWindowMs: config.bidding.windowMs,
          expiresAt: existingIntent.expiresAt.toISOString(),
          status: 'error',
          message: 'Intent already exists'
        };
      }

      // 4. Recover signer from signature
      const signer = await this.recoverSigner(intent, signature);
      if (!signer) {
        logger.warn('Failed to recover signer from signature', { intentHash });
        return {
          intentHash: '',
          biddingWindowMs: 0,
          expiresAt: '',
          status: 'error',
          message: 'Invalid signature'
        };
      }

      // 5. Verify signature
      const isValidSignature = await CryptoUtils.verifyIntentSignature(
        intent,
        signature as `0x${string}`,
        signer
      );

      if (!isValidSignature) {
        logger.warn('Intent signature verification failed', { 
          intentHash, 
          signer 
        });
        
        return {
          intentHash: '',
          biddingWindowMs: 0,
          expiresAt: '',
          status: 'error',
          message: 'Invalid signature'
        };
      }

      // 6. Calculate expiry time
      const deadline = parseInt(intent.deadline);
      const expiresAt = new Date(deadline * 1000);

      // Check if already expired
      if (expiresAt.getTime() <= Date.now()) {
        logger.warn('Intent already expired', { intentHash, deadline });
        return {
          intentHash: '',
          biddingWindowMs: 0,
          expiresAt: '',
          status: 'error',
          message: 'Intent deadline has already passed'
        };
      }

      // 7. Store intent in database
      const intentRecord = await IntentModel.create({
        intentHash,
        payload: intent,
        signature,
        signer,
        expiresAt
      });

      logger.intent('created', intentHash, {
        signer,
        tokenIn: intent.tokenIn,
        tokenOut: intent.tokenOut,
        amountIn: intent.amountIn,
        expiresAt: expiresAt.toISOString()
      });

      // 8. Cache intent for quick access
      await redis.set(
        `intent:${intentHash}`,
        intentRecord,
        { ttl: Math.floor((expiresAt.getTime() - Date.now()) / 1000) }
      );

      // 9. Update intent status to broadcasting
      await IntentModel.updateStatus(intentHash, IntentStatus.BROADCASTING);

      // 10. Broadcast to solvers (will be handled by WebSocket service)
      await this.broadcastIntentToSolvers(intentHash, intent);

      // 11. Set bidding window timeout
      setTimeout(async () => {
        await this.closeBiddingWindow(intentHash);
      }, config.bidding.windowMs);

      return {
        intentHash,
        biddingWindowMs: config.bidding.windowMs,
        expiresAt: expiresAt.toISOString(),
        status: 'success'
      };

    } catch (error) {
      logger.error('Failed to create intent', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        intent 
      });

      return {
        intentHash: '',
        biddingWindowMs: 0,
        expiresAt: '',
        status: 'error',
        message: 'Internal server error'
      };
    }
  }

  /**
   * Get intent by hash
   */
  static async getIntent(intentHash: string): Promise<IntentRecord | null> {
    try {
      // Try cache first
      const cached = await redis.get<IntentRecord>(`intent:${intentHash}`);
      if (cached) {
        return cached;
      }

      // Fallback to database
      const intent = await IntentModel.findByHash(intentHash);
      if (intent) {
        // Cache for future requests
        const ttl = Math.max(0, Math.floor((intent.expiresAt.getTime() - Date.now()) / 1000));
        if (ttl > 0) {
          await redis.set(`intent:${intentHash}`, intent, { ttl });
        }
      }

      return intent;

    } catch (error) {
      logger.error('Failed to get intent', { intentHash, error });
      return null;
    }
  }

  /**
   * Update intent status
   */
  static async updateIntentStatus(
    intentHash: string,
    status: IntentStatus
  ): Promise<boolean> {
    try {
      const updated = await IntentModel.updateStatus(intentHash, status);
      if (updated) {
        // Update cache
        const cached = await redis.get<IntentRecord>(`intent:${intentHash}`);
        if (cached) {
          cached.status = status;
          cached.updatedAt = new Date();
          await redis.set(`intent:${intentHash}`, cached);
        }

        logger.intent('status_updated', intentHash, { status });
        return true;
      }
      return false;

    } catch (error) {
      logger.error('Failed to update intent status', { intentHash, status, error });
      return false;
    }
  }

  /**
   * Get intent statistics
   */
  static async getIntentStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    last24h: number;
  }> {
    try {
      return await IntentModel.getStats();
    } catch (error) {
      logger.error('Failed to get intent stats', { error });
      return {
        total: 0,
        byStatus: {},
        last24h: 0
      };
    }
  }

  /**
   * Process expired intents
   */
  static async processExpiredIntents(): Promise<number> {
    try {
      const expiredIntents = await IntentModel.findExpired(100);
      let processedCount = 0;

      for (const intent of expiredIntents) {
        await this.updateIntentStatus(intent.intentHash, IntentStatus.EXPIRED);
        
        // Remove from cache
        await redis.del(`intent:${intent.intentHash}`);
        
        logger.intent('expired', intent.intentHash);
        processedCount++;
      }

      if (processedCount > 0) {
        logger.info(`Processed ${processedCount} expired intents`);
      }

      return processedCount;

    } catch (error) {
      logger.error('Failed to process expired intents', { error });
      return 0;
    }
  }

  /**
   * Recover signer address from intent and signature
   */
  private static async recoverSigner(intent: Intent, signature: string): Promise<string | null> {
    try {
      // This is a simplified implementation
      // In a real implementation, you would use proper signature recovery
      // For now, we'll extract it from the intent receiver as a placeholder
      return CryptoUtils.normalizeAddress(intent.receiver);
    } catch (error) {
      logger.error('Failed to recover signer', { error });
      return null;
    }
  }

  /**
   * Broadcast intent to solvers via Redis pub/sub
   */
  private static async broadcastIntentToSolvers(
    intentHash: string,
    intent: Intent
  ): Promise<void> {
    try {
      const message = {
        type: 'IntentCreated',
        intentHash,
        intent: {
          tokenIn: intent.tokenIn,
          tokenOut: intent.tokenOut,
          amountIn: intent.amountIn,
          maxSlippageBps: intent.maxSlippageBps,
          deadline: intent.deadline,
          receiver: intent.receiver
        },
        biddingWindowMs: config.bidding.windowMs,
        createdAt: new Date().toISOString()
      };

      await redis.publish('solver:intents', message);
      
      logger.info('Intent broadcasted to solvers', { intentHash });

    } catch (error) {
      logger.error('Failed to broadcast intent to solvers', { intentHash, error });
    }
  }

  /**
   * Close bidding window for an intent
   */
  private static async closeBiddingWindow(intentHash: string): Promise<void> {
    try {
      const intent = await this.getIntent(intentHash);
      if (!intent || intent.status !== IntentStatus.BIDDING) {
        return;
      }

      // Update status to indicate bidding closed
      await this.updateIntentStatus(intentHash, IntentStatus.BIDDING);

      logger.intent('bidding_closed', intentHash);

      // Notify coordinator to select winning bid
      await redis.publish('coordinator:bid_selection', {
        type: 'SelectWinningBid',
        intentHash,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Failed to close bidding window', { intentHash, error });
    }
  }
}

export default IntentService;