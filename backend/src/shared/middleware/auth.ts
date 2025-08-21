/**
 * @fileoverview Authentication and authorization middleware
 * @description JWT-based authentication for API endpoints and WebSocket connections
 */

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import { appLogger as logger } from '@/utils/index.js';

// Extend Request interface to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        type: 'solver' | 'frontend' | 'admin';
        solverId?: string;
        permissions?: string[];
      };
      requestId?: string;
    }
  }
}

export interface JWTPayload {
  id: string;
  type: 'solver' | 'frontend' | 'admin';
  solverId?: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

/**
 * Authentication middleware for API endpoints
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.security('Authentication failed: No token provided', 'medium', {
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });

      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
        timestamp: new Date().toISOString()
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify JWT token
    const decoded = jwt.verify(token, config.api.jwtSecret) as JWTPayload;
    
    // Attach user info to request
    req.user = {
      id: decoded.id,
      type: decoded.type,
      solverId: decoded.solverId,
      permissions: decoded.permissions || []
    };

    logger.info('User authenticated', {
      requestId: req.requestId,
      userId: decoded.id,
      userType: decoded.type,
      solverId: decoded.solverId
    });

    next();

  } catch (error) {
    logger.security('Authentication failed: Invalid token', 'medium', {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Authorization middleware for role-based access
 */
export const authorize = (allowedTypes: string[], requiredPermissions: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
        timestamp: new Date().toISOString()
      });
    }

    // Check user type
    if (!allowedTypes.includes(req.user.type)) {
      logger.security('Authorization failed: Insufficient privileges', 'medium', {
        requestId: req.requestId,
        userId: req.user.id,
        userType: req.user.type,
        requiredTypes: allowedTypes,
        endpoint: req.originalUrl
      });

      return res.status(403).json({
        status: 'error',
        message: 'Insufficient privileges',
        timestamp: new Date().toISOString()
      });
    }

    // Check specific permissions if required
    if (requiredPermissions.length > 0) {
      const userPermissions = req.user.permissions || [];
      const hasAllPermissions = requiredPermissions.every(permission => 
        userPermissions.includes(permission)
      );

      if (!hasAllPermissions) {
        logger.security('Authorization failed: Missing permissions', 'medium', {
          requestId: req.requestId,
          userId: req.user.id,
          userPermissions,
          requiredPermissions,
          endpoint: req.originalUrl
        });

        return res.status(403).json({
          status: 'error',
          message: 'Missing required permissions',
          timestamp: new Date().toISOString()
        });
      }
    }

    next();
  };
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, config.api.jwtSecret) as JWTPayload;
      req.user = {
        id: decoded.id,
        type: decoded.type,
        solverId: decoded.solverId,
        permissions: decoded.permissions || []
      };
    } catch (error) {
      // Ignore invalid tokens for optional auth
      logger.debug('Optional auth: Invalid token ignored', {
        requestId: req.requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  next();
};

/**
 * Rate limiting middleware factory
 */
export const createRateLimit = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}) => {
  const {
    windowMs = config.api.rateLimit.windowMs,
    max = config.api.rateLimit.max,
    message = 'Too many requests from this IP',
    skipSuccessfulRequests = false,
    keyGenerator
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      status: 'error',
      message,
      timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    keyGenerator: keyGenerator || ((req: Request) => {
      // Use user ID if authenticated, otherwise IP
      return req.user?.id || req.ip;
    }),
    handler: (req: Request, res: Response) => {
      logger.security('Rate limit exceeded', 'low', {
        requestId: req.requestId,
        ip: req.ip,
        userId: req.user?.id,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent')
      });

      res.status(429).json({
        status: 'error',
        message,
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString()
      });
    }
  });
};

/**
 * API key authentication for internal services
 */
export const authenticateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      status: 'error',
      message: 'API key required',
      timestamp: new Date().toISOString()
    });
  }

  // In a real implementation, validate against database
  // For now, use a simple comparison
  const validApiKeys = [
    config.api.jwtSecret, // Temporary - should be different keys
  ];

  if (!validApiKeys.includes(apiKey)) {
    logger.security('Invalid API key used', 'high', {
      requestId: req.requestId,
      ip: req.ip,
      providedKey: apiKey.substring(0, 8) + '...',
      endpoint: req.originalUrl
    });

    return res.status(401).json({
      status: 'error',
      message: 'Invalid API key',
      timestamp: new Date().toISOString()
    });
  }

  // Set internal user context
  req.user = {
    id: 'internal',
    type: 'admin',
    permissions: ['*']
  };

  next();
};

/**
 * Generate JWT token for authentication
 */
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, config.api.jwtSecret, {
    expiresIn: '24h',
    issuer: 'intendly-backend',
    audience: 'intendly-client'
  });
};

/**
 * Generate WebSocket token for real-time connections
 */
export const generateWSToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, config.api.jwtSecret, {
    expiresIn: '1h', // Shorter expiry for WebSocket tokens
    issuer: 'intendly-backend',
    audience: 'intendly-websocket'
  });
};

/**
 * Verify WebSocket token
 */
export const verifyWSToken = (token: string): JWTPayload => {
  return jwt.verify(token, config.api.jwtSecret, {
    issuer: 'intendly-backend',
    audience: 'intendly-websocket'
  }) as JWTPayload;
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove server header
  res.removeHeader('X-Powered-By');

  next();
};

export default {
  authenticate,
  authorize,
  optionalAuth,
  createRateLimit,
  authenticateApiKey,
  generateToken,
  generateWSToken,
  verifyWSToken,
  securityHeaders
};