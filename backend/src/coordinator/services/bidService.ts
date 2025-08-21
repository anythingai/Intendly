/**
 * @fileoverview Bid service for validation, scoring, and selection
 * @description Handles bid lifecycle management and winner selection
 */

import { BidModel } from '@/database/models/bid.js';
import { IntentModel } from '@/database/models/intent.js';
import { 
  BidSubmission, 
  BidResponse, 
  BidRecord, 
  BidStatus, 
  BestBidResponse,
  BidLike,
  DEFAULT_BID_SCORING,
  BidScoringConfig
} from '@/types/bid.js';
import { IntentStatus } from '@/types/intent.js';
import { CryptoUtils, redis, coordinatorLogger as logger, blockchainService } from '@/utils/index.js';
import config from '@/shared/config/index.js';

export interface BidScore {
  totalScore: number;
  effectiveOutput: bigint;
  rank: number;
  components: {
    feeScore: number;
    speedScore: number;
    outputScore: number;
    reputationScore: number;
  };
}

export class BidService {
  private static scoringConfig: BidScoringConfig = DEFAULT_BID_SCORING;

  /**
   * Submit a new bid for an intent
   */
  static async submitBid(submission: BidSubmission): Promise<BidResponse> {
    try {
      // 1. Validate bid structure
      const structureValidation = CryptoUtils.validateBidStructure(submission);
      if (!structureValidation.isValid) {
        logger.warn('Bid structure validation failed', {
          intentHash: submission.intentHash,
          errors: structureValidation.errors
        });

        return {
          accepted: false,
          error: structureValidation.errors.join(', ')
        };
      }

      // 2. Check if intent exists and is accepting bids
      const intent = await IntentModel.findByHash(submission.intentHash);
      if (!intent) {
        logger.warn('Intent not found for bid submission', {
          intentHash: submission.intentHash
        });

        return {
          accepted: false,
          error: 'Intent not found'
        };
      }

      if (intent.status !== IntentStatus.BIDDING && intent.status !== IntentStatus.BROADCASTING) {
        logger.warn('Intent not accepting bids', {
          intentHash: submission.intentHash,
          status: intent.status
        });

        return {
          accepted: false,
          error: `Intent status ${intent.status} - not accepting bids`
        };
      }

      // 3. Check if intent has expired
      if (intent.expiresAt.getTime() <= Date.now()) {
        logger.warn('Bid submitted for expired intent', {
          intentHash: submission.intentHash,
          expiresAt: intent.expiresAt
        });

        return {
          accepted: false,
          error: 'Intent has expired'
        };
      }

      // 4. Extract solver ID from signature (simplified - in real implementation, verify signature)
      const solverId = await this.extractSolverFromSignature(submission.solverSig);
      if (!solverId) {
        return {
          accepted: false,
          error: 'Invalid solver signature'
        };
      }

      // 5. Verify bid signature
      const isValidSignature = await CryptoUtils.verifyBidSignature(
        submission,
        submission.solverSig as `0x${string}`,
        solverId
      );

      if (!isValidSignature) {
        logger.warn('Bid signature verification failed', {
          intentHash: submission.intentHash,
          solverId
        });

        return {
          accepted: false,
          error: 'Invalid signature'
        };
      }

      // 6. Validate bid against blockchain (optional)
      if (config.development.debug) {
        const isValidOnChain = await blockchainService.validateBid(
          submission.intentHash,
          {
            solver: solverId,
            quoteOut: submission.quoteOut,
            solverFeeBps: submission.solverFeeBps,
            calldataHint: submission.calldataHint
          }
        );

        if (!isValidOnChain) {
          logger.warn('Bid validation failed on-chain', {
            intentHash: submission.intentHash,
            solverId
          });
        }
      }

      // 7. Store bid in database
      const bidRecord = await BidModel.create({
        intentHash: submission.intentHash,
        solverId,
        quoteOut: submission.quoteOut,
        solverFeeBps: submission.solverFeeBps,
        payloadUri: submission.calldataHint, // Store calldata hint as payload URI
        solverSignature: submission.solverSig
      });

      logger.bid('submitted', submission.intentHash, solverId, {
        bidId: bidRecord.id,
        quoteOut: submission.quoteOut,
        solverFeeBps: submission.solverFeeBps
      });

      // 8. Update intent status to bidding if it's still broadcasting
      if (intent.status === IntentStatus.BROADCASTING) {
        await IntentModel.updateStatus(submission.intentHash, IntentStatus.BIDDING);
      }

      // 9. Score and rank the bid
      const { score, rank } = await this.scoreBid(bidRecord, submission.intentHash);
      
      // Update bid with score and rank
      await BidModel.updateScoreAndRank(bidRecord.id, score.totalScore, rank);

      // 10. Update intent's best bid if this is better
      await this.updateBestBidIfBetter(submission.intentHash, bidRecord, score);

      // 11. Broadcast bid update
      await this.broadcastBidUpdate(submission.intentHash, bidRecord, rank);

      logger.bid('accepted', submission.intentHash, solverId, {
        bidId: bidRecord.id,
        rank,
        score: score.totalScore
      });

      return {
        accepted: true,
        bidId: bidRecord.id,
        rank,
        score: score.totalScore
      };

    } catch (error) {
      logger.error('Failed to submit bid', {
        intentHash: submission.intentHash,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        accepted: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Get best bid for an intent
   */
  static async getBestBid(intentHash: string): Promise<BestBidResponse> {
    try {
      const [bestBid, allBids, intent] = await Promise.all([
        BidModel.getBestBid(intentHash),
        BidModel.findByIntentHash(intentHash),
        IntentModel.findByHash(intentHash)
      ]);

      if (!intent) {
        return {
          bid: null,
          totalBids: 0,
          windowClosesAt: new Date().toISOString()
        };
      }

      // Calculate when bidding window closes
      const biddingStarted = intent.updatedAt.getTime();
      const windowClosesAt = new Date(biddingStarted + config.bidding.windowMs);

      const response: BestBidResponse = {
        bid: bestBid ? this.convertToBidLike(bestBid) : null,
        totalBids: allBids.length,
        windowClosesAt: windowClosesAt.toISOString()
      };

      if (bestBid) {
        response.score = bestBid.score;
        
        // Calculate improvement over baseline (simplified)
        const baselineOutput = BigInt(intent.payload.amountIn);
        const bidOutput = BigInt(bestBid.quoteOut);
        const improvement = ((bidOutput - baselineOutput) * 10000n) / baselineOutput;
        response.improvement = improvement.toString();
      }

      return response;

    } catch (error) {
      logger.error('Failed to get best bid', { intentHash, error });
      return {
        bid: null,
        totalBids: 0,
        windowClosesAt: new Date().toISOString()
      };
    }
  }

  /**
   * Select winning bid for an intent
   */
  static async selectWinningBid(intentHash: string): Promise<BidRecord | null> {
    try {
      const bestBid = await BidModel.getBestBid(intentHash);
      
      if (!bestBid) {
        logger.warn('No bids available for winner selection', { intentHash });
        return null;
      }

      // Update winning bid status
      await BidModel.updateStatus(bestBid.id, BidStatus.WON);

      // Update losing bids
      const allBids = await BidModel.findByIntentHash(intentHash);
      for (const bid of allBids) {
        if (bid.id !== bestBid.id && bid.status === BidStatus.ACCEPTED) {
          await BidModel.updateStatus(bid.id, BidStatus.LOST);
        }
      }

      logger.bid('won', intentHash, bestBid.solverId, {
        bidId: bestBid.id,
        quoteOut: bestBid.quoteOut,
        rank: bestBid.rank
      });

      // Broadcast winner selection
      await redis.publish('coordinator:winner_selected', {
        type: 'WinnerSelected',
        intentHash,
        winningBid: this.convertToBidLike(bestBid),
        timestamp: Date.now()
      });

      return bestBid;

    } catch (error) {
      logger.error('Failed to select winning bid', { intentHash, error });
      return null;
    }
  }

  /**
   * Score a bid based on various criteria
   */
  private static async scoreBid(bid: BidRecord, intentHash: string): Promise<{ score: BidScore; rank: number }> {
    try {
      const intent = await IntentModel.findByHash(intentHash);
      if (!intent) {
        throw new Error('Intent not found for scoring');
      }

      // Get all current bids for ranking context
      const allBids = await BidModel.findByIntentHash(intentHash);
      
      // Calculate component scores
      const feeScore = this.calculateFeeScore(bid.solverFeeBps);
      const speedScore = this.calculateSpeedScore(bid.arrivedAt, intent.createdAt);
      const outputScore = this.calculateOutputScore(bid.quoteOut, intent.payload.amountIn);
      const reputationScore = await this.calculateReputationScore(bid.solverId);

      // Calculate weighted total score
      const totalScore = 
        (feeScore * this.scoringConfig.feeWeight) +
        (speedScore * this.scoringConfig.speedWeight) +
        (outputScore * this.scoringConfig.outputWeight) +
        (reputationScore * this.scoringConfig.reputationWeight);

      const effectiveOutput = BigInt(bid.quoteOut) - 
        (BigInt(bid.quoteOut) * BigInt(bid.solverFeeBps)) / 10000n;

      const score: BidScore = {
        totalScore,
        effectiveOutput,
        rank: 0, // Will be calculated below
        components: {
          feeScore,
          speedScore,
          outputScore,
          reputationScore
        }
      };

      // Calculate rank among all bids
      const rank = allBids.filter(otherBid => {
        if (otherBid.id === bid.id) return false;
        const otherEffectiveOutput = BigInt(otherBid.quoteOut) - 
          (BigInt(otherBid.quoteOut) * BigInt(otherBid.solverFeeBps)) / 10000n;
        return otherEffectiveOutput > effectiveOutput;
      }).length + 1;

      score.rank = rank;

      return { score, rank };

    } catch (error) {
      logger.error('Failed to score bid', { bidId: bid.id, intentHash, error });
      
      // Return default score
      return {
        score: {
          totalScore: 0,
          effectiveOutput: BigInt(bid.quoteOut),
          rank: 999,
          components: {
            feeScore: 0,
            speedScore: 0,
            outputScore: 0,
            reputationScore: 0
          }
        },
        rank: 999
      };
    }
  }

  /**
   * Calculate fee score (lower fees = higher score)
   */
  private static calculateFeeScore(solverFeeBps: number): number {
    const maxFee = config.bidding.maxSolverFeeBps;
    return Math.max(0, (maxFee - solverFeeBps) / maxFee * 100);
  }

  /**
   * Calculate speed score (faster submissions = higher score)
   */
  private static calculateSpeedScore(arrivedAt: Date, createdAt: Date): number {
    const responseTime = arrivedAt.getTime() - createdAt.getTime();
    const maxResponseTime = config.bidding.windowMs;
    return Math.max(0, (maxResponseTime - responseTime) / maxResponseTime * 100);
  }

  /**
   * Calculate output score (higher output = higher score)
   */
  private static calculateOutputScore(quoteOut: string, amountIn: string): number {
    try {
      const quote = BigInt(quoteOut);
      const input = BigInt(amountIn);
      const improvement = Number((quote - input) * 100n / input);
      return Math.max(0, Math.min(100, improvement));
    } catch {
      return 0;
    }
  }

  /**
   * Calculate reputation score for solver
   */
  private static async calculateReputationScore(solverId: string): Promise<number> {
    try {
      const metrics = await BidModel.getSolverMetrics(solverId);
      // Simple reputation based on win rate
      return metrics.winRate;
    } catch {
      return 50; // Default score for new solvers
    }
  }

  /**
   * Update best bid for intent if current bid is better
   */
  private static async updateBestBidIfBetter(
    intentHash: string,
    bid: BidRecord,
    score: BidScore
  ): Promise<void> {
    try {
      const currentBest = await BidModel.getBestBid(intentHash);
      
      if (!currentBest || score.effectiveOutput > (currentBest.score || 0)) {
        const bidLike = this.convertToBidLike(bid);
        await IntentModel.updateBestBid(
          intentHash,
          JSON.stringify(bidLike),
          1 // We'll update this properly later
        );
      }
    } catch (error) {
      logger.error('Failed to update best bid', { intentHash, error });
    }
  }

  /**
   * Broadcast bid update to WebSocket clients
   */
  private static async broadcastBidUpdate(
    intentHash: string,
    bid: BidRecord,
    rank: number
  ): Promise<void> {
    try {
      await redis.publish('websocket:bid_update', {
        type: 'BidReceived',
        data: {
          intentHash,
          solverId: bid.solverId,
          quoteOut: bid.quoteOut,
          solverFeeBps: bid.solverFeeBps,
          rank,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to broadcast bid update', { intentHash, error });
    }
  }

  /**
   * Convert BidRecord to BidLike format
   */
  private static convertToBidLike(bid: BidRecord): BidLike {
    return {
      solver: bid.solverId,
      quoteOut: bid.quoteOut,
      solverFeeBps: bid.solverFeeBps,
      calldataHint: bid.payloadUri || '0x'
    };
  }

  /**
   * Extract solver address from signature (simplified)
   */
  private static async extractSolverFromSignature(signature: string): Promise<string | null> {
    try {
      // In a real implementation, this would recover the address from the signature
      // For now, we'll generate a mock solver address
      return '0x' + signature.slice(-40);
    } catch {
      return null;
    }
  }
}

export default BidService;