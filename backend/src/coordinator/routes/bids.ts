/**
 * @fileoverview Bid routes for the coordinator service
 * @description HTTP endpoints for bid submission and management
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { BidService } from '../services/bidService.js';
import { BidSubmission } from '@/types/bid.js';
import { coordinatorLogger as logger, requestLoggingMiddleware } from '@/utils/index.js';
import config from '@/shared/config/index.js';

const router = Router();

// Rate limiting for bid submission
const bidSubmissionLimit = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 50, // 50 bids per 10 seconds per IP
  message: {
    error: 'Too many bid submissions',
    message: 'Maximum 50 bids per 10 seconds allowed'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation rules for bid submission
const submitBidValidation = [
  body('intentHash')
    .isString()
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid intent hash format'),
  
  body('quoteOut')
    .isString()
    .matches(/^\d+$/)
    .withMessage('Invalid quoteOut - must be a positive integer string'),
  
  body('solverFeeBps')
    .isInt({ min: 0, max: config.bidding.maxSolverFeeBps })
    .withMessage(`Invalid solverFeeBps - must be between 0 and ${config.bidding.maxSolverFeeBps}`),
  
  body('calldataHint')
    .isString()
    .matches(/^0x[a-fA-F0-9]*$/)
    .withMessage('Invalid calldataHint - must be valid hex string'),
  
  body('ttlMs')
    .isInt({ min: 1000, max: 300000 })
    .withMessage('Invalid ttlMs - must be between 1000ms and 300000ms'),
  
  body('solverSig')
    .isString()
    .matches(/^0x[a-fA-F0-9]{130}$/)
    .withMessage('Invalid solver signature format'),
];

const getBestBidValidation = [
  param('intentHash')
    .isString()
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid intent hash format'),
];

/**
 * POST /api/bids
 * Submit a new bid for an intent
 */
router.post('/',
  bidSubmissionLimit,
  submitBidValidation,
  async (req: Request, res: Response) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Bid submission validation failed', {
          requestId: req.requestId,
          errors: errors.array(),
          body: req.body
        });

        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const submission: BidSubmission = req.body;
      
      logger.info('Bid submission received', {
        requestId: req.requestId,
        intentHash: submission.intentHash,
        quoteOut: submission.quoteOut,
        solverFeeBps: submission.solverFeeBps
      });

      // Process bid
      const result = await BidService.submitBid(submission);

      if (result.accepted) {
        logger.bid('submitted', submission.intentHash, 'solver', {
          requestId: req.requestId,
          bidId: result.bidId,
          rank: result.rank,
          score: result.score
        });

        res.status(201).json({
          status: 'success',
          data: result,
          timestamp: new Date().toISOString()
        });
      } else {
        logger.warn('Bid submission rejected', {
          requestId: req.requestId,
          intentHash: submission.intentHash,
          error: result.error
        });

        res.status(400).json({
          status: 'error',
          message: result.error,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error('Bid submission error', {
        requestId: req.requestId,
        intentHash: req.body?.intentHash,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/intents/:intentHash/bestBid
 * Get the best bid for a specific intent
 */
router.get('/intents/:intentHash/bestBid',
  getBestBidValidation,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid intent hash',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const { intentHash } = req.params;
      const bestBid = await BidService.getBestBid(intentHash);

      logger.info('Best bid retrieved', {
        requestId: req.requestId,
        intentHash,
        hasBid: bestBid.bid !== null,
        totalBids: bestBid.totalBids
      });

      res.json({
        status: 'success',
        data: bestBid,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to get best bid', {
        requestId: req.requestId,
        intentHash: req.params.intentHash,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /api/intents/:intentHash/selectWinner
 * Select winning bid for an intent (internal endpoint)
 */
router.post('/intents/:intentHash/selectWinner',
  getBestBidValidation,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid intent hash',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const { intentHash } = req.params;
      const winningBid = await BidService.selectWinningBid(intentHash);

      if (winningBid) {
        logger.info('Winning bid selected', {
          requestId: req.requestId,
          intentHash,
          winningBidId: winningBid.id,
          solverId: winningBid.solverId,
          quoteOut: winningBid.quoteOut
        });

        res.json({
          status: 'success',
          data: {
            winningBid: {
              bidId: winningBid.id,
              solverId: winningBid.solverId,
              quoteOut: winningBid.quoteOut,
              solverFeeBps: winningBid.solverFeeBps,
              rank: winningBid.rank
            }
          },
          timestamp: new Date().toISOString()
        });
      } else {
        logger.warn('No winning bid found', {
          requestId: req.requestId,
          intentHash
        });

        res.status(404).json({
          status: 'error',
          message: 'No bids available for selection',
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error('Failed to select winning bid', {
        requestId: req.requestId,
        intentHash: req.params.intentHash,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/bids
 * List bids with pagination and filtering
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('intentHash').optional().matches(/^0x[a-fA-F0-9]{64}$/).withMessage('Invalid intent hash'),
    query('solverId').optional().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid solver ID'),
    query('status').optional().isIn(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WON', 'LOST', 'INVALID']),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid query parameters',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      // For now, return a placeholder response
      res.json({
        status: 'success',
        data: {
          bids: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0
          },
          message: 'Bid listing not yet implemented'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to list bids', {
        requestId: req.requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;