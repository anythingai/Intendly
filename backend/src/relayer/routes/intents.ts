/**
 * @fileoverview Intent routes for the relayer service
 * @description HTTP endpoints for intent submission and management
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { IntentService } from '../services/intentService.js';
import { CreateIntentRequest } from '@/types/intent.js';
import { relayerLogger as logger, requestLoggingMiddleware } from '@/utils/index.js';
import config from '@/shared/config/index.js';

const router = Router();

// Rate limiting for intent submission
const intentSubmissionLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 intents per minute per IP
  message: {
    error: 'Too many intent submissions',
    message: 'Maximum 10 intents per minute allowed'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation rules
const createIntentValidation = [
  body('intent.tokenIn')
    .isString()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid tokenIn address'),
  
  body('intent.tokenOut')
    .isString()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid tokenOut address'),
  
  body('intent.amountIn')
    .isString()
    .matches(/^\d+$/)
    .withMessage('Invalid amountIn - must be a positive integer string'),
  
  body('intent.maxSlippageBps')
    .isInt({ min: 0, max: 10000 })
    .withMessage('Invalid maxSlippageBps - must be between 0 and 10000'),
  
  body('intent.deadline')
    .isString()
    .matches(/^\d+$/)
    .withMessage('Invalid deadline - must be a timestamp string'),
  
  body('intent.chainId')
    .isString()
    .equals(config.blockchain.chainId.toString())
    .withMessage(`Invalid chainId - must be ${config.blockchain.chainId}`),
  
  body('intent.receiver')
    .isString()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid receiver address'),
  
  body('intent.nonce')
    .isString()
    .matches(/^\d+$/)
    .withMessage('Invalid nonce - must be a positive integer string'),
  
  body('signature')
    .isString()
    .matches(/^0x[a-fA-F0-9]{130}$/)
    .withMessage('Invalid signature format'),
];

const getIntentValidation = [
  param('hash')
    .isString()
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid intent hash format'),
];

/**
 * POST /api/intents
 * Submit a new intent for processing
 */
router.post('/', 
  intentSubmissionLimit,
  createIntentValidation,
  async (req: Request, res: Response) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Intent submission validation failed', {
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

      const request: CreateIntentRequest = req.body;
      
      logger.info('Intent submission received', {
        requestId: req.requestId,
        intentHash: 'pending',
        tokenIn: request.intent.tokenIn,
        tokenOut: request.intent.tokenOut,
        amountIn: request.intent.amountIn
      });

      // Process intent
      const result = await IntentService.createIntent(request);

      if (result.status === 'success') {
        logger.intent('submitted', result.intentHash, {
          requestId: req.requestId,
          biddingWindowMs: result.biddingWindowMs,
          expiresAt: result.expiresAt
        });

        res.status(201).json({
          status: 'success',
          data: result,
          timestamp: new Date().toISOString()
        });
      } else {
        logger.warn('Intent submission failed', {
          requestId: req.requestId,
          error: result.message
        });

        res.status(400).json({
          status: 'error',
          message: result.message,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error('Intent submission error', {
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

/**
 * GET /api/intents/:hash
 * Get intent details by hash
 */
router.get('/:hash',
  getIntentValidation,
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

      const { hash } = req.params;
      const intent = await IntentService.getIntent(hash);

      if (!intent) {
        logger.warn('Intent not found', {
          requestId: req.requestId,
          intentHash: hash
        });

        return res.status(404).json({
          status: 'error',
          message: 'Intent not found',
          timestamp: new Date().toISOString()
        });
      }

      logger.info('Intent retrieved', {
        requestId: req.requestId,
        intentHash: hash,
        status: intent.status
      });

      res.json({
        status: 'success',
        data: {
          intent: intent.payload,
          status: intent.status,
          createdAt: intent.createdAt.toISOString(),
          expiresAt: intent.expiresAt.toISOString(),
          totalBids: intent.totalBids || 0
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to get intent', {
        requestId: req.requestId,
        intentHash: req.params.hash,
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
 * GET /api/intents
 * List intents with pagination and filtering
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['NEW', 'BROADCASTING', 'BIDDING', 'FILLED', 'EXPIRED', 'FAILED', 'CANCELLED']),
    query('signer').optional().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid signer address'),
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

      // For now, just return stats since we don't have a list method implemented
      const stats = await IntentService.getIntentStats();

      res.json({
        status: 'success',
        data: {
          stats,
          message: 'Intent listing not yet implemented'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to list intents', {
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

/**
 * GET /api/intents/stats
 * Get intent statistics
 */
router.get('/stats',
  async (req: Request, res: Response) => {
    try {
      const stats = await IntentService.getIntentStats();

      res.json({
        status: 'success',
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to get intent stats', {
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