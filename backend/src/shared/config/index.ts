/**
 * @fileoverview Configuration management for backend services
 * @description Environment-aware configuration with validation
 */

import dotenv from 'dotenv';
import Joi from 'joi';

// Load environment variables
dotenv.config();

// Configuration schema for validation
const configSchema = Joi.object({
  // Node environment
  NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').default('development'),
  
  // Server configuration
  API_PORT: Joi.number().port().default(3001),
  WS_PORT: Joi.number().port().default(3002),
  HOST: Joi.string().default('0.0.0.0'),
  
  // Database configuration
  DATABASE_URL: Joi.string().uri().required(),
  DB_POOL_MIN: Joi.number().min(0).default(2),
  DB_POOL_MAX: Joi.number().min(1).default(10),
  
  // Redis configuration
  REDIS_URL: Joi.string().uri().required(),
  REDIS_KEY_PREFIX: Joi.string().default('intendly:'),
  
  // Blockchain configuration
  CHAIN_ID: Joi.number().default(196), // X Layer
  RPC_URL: Joi.string().uri().required(),
  PERMIT2_ADDRESS: Joi.string().hex().length(42).required(),
  ROUTER_ADDRESS: Joi.string().hex().length(42).required(),
  SETTLEMENT_CONTRACT_ADDRESS: Joi.string().hex().length(42).required(),
  
  // API configuration
  API_RATE_LIMIT_WINDOW: Joi.number().default(900000), // 15 minutes
  API_RATE_LIMIT_MAX: Joi.number().default(100),
  JWT_SECRET: Joi.string().min(32).required(),
  
  // Bidding configuration
  BIDDING_WINDOW_MS: Joi.number().default(3000), // 3 seconds
  MAX_SOLVER_FEE_BPS: Joi.number().max(100).default(30), // 0.3%
  MIN_BID_COUNT: Joi.number().min(1).default(1),
  
  // WebSocket configuration
  WS_HEARTBEAT_INTERVAL: Joi.number().default(30000), // 30 seconds
  WS_CONNECTION_TIMEOUT: Joi.number().default(60000), // 1 minute
  
  // Logging configuration
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FILE_PATH: Joi.string().default('./logs'),
  LOG_MAX_FILES: Joi.number().default(14),
  LOG_MAX_SIZE: Joi.string().default('20m'),
  
  // Monitoring configuration
  METRICS_ENABLED: Joi.boolean().default(true),
  PROMETHEUS_PORT: Joi.number().port().default(9090),
  
  // Development configuration
  ENABLE_DEBUG: Joi.boolean().default(false),
  MOCK_SOLVER_ENABLED: Joi.boolean().default(false),
  
  // Security configuration
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  HELMET_ENABLED: Joi.boolean().default(true),
  
  // External services
  SOLVER_REGISTRY_PRIVATE_KEY: Joi.string().hex().length(64).optional(),
});

// Validate and extract configuration
const { error, value: envVars } = configSchema.validate(process.env, {
  allowUnknown: true,
  stripUnknown: true,
});

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export interface Config {
  // Environment
  env: string;
  isDevelopment: boolean;
  isProduction: boolean;
  
  // Server
  server: {
    apiPort: number;
    wsPort: number;
    host: string;
  };
  
  // Database
  database: {
    url: string;
    pool: {
      min: number;
      max: number;
    };
  };
  
  // Redis
  redis: {
    url: string;
    keyPrefix: string;
  };
  
  // Blockchain
  blockchain: {
    chainId: number;
    rpcUrl: string;
    permit2Address: string;
    routerAddress: string;
    settlementContract: string;
  };
  
  // API
  api: {
    rateLimit: {
      windowMs: number;
      max: number;
    };
    jwtSecret: string;
  };
  
  // Bidding
  bidding: {
    windowMs: number;
    maxSolverFeeBps: number;
    minBidCount: number;
  };
  
  // WebSocket
  websocket: {
    heartbeatInterval: number;
    connectionTimeout: number;
  };
  
  // Logging
  logging: {
    level: string;
    filePath: string;
    maxFiles: number;
    maxSize: string;
  };
  
  // Monitoring
  monitoring: {
    enabled: boolean;
    prometheusPort: number;
  };
  
  // Development
  development: {
    debug: boolean;
    mockSolver: boolean;
  };
  
  // Security
  security: {
    corsOrigins: string[];
    helmetEnabled: boolean;
  };
  
  // External services
  external: {
    solverRegistryKey?: string;
  };
}

// Create typed configuration object
const config: Config = {
  env: envVars.NODE_ENV,
  isDevelopment: envVars.NODE_ENV === 'development',
  isProduction: envVars.NODE_ENV === 'production',
  
  server: {
    apiPort: envVars.API_PORT,
    wsPort: envVars.WS_PORT,
    host: envVars.HOST,
  },
  
  database: {
    url: envVars.DATABASE_URL,
    pool: {
      min: envVars.DB_POOL_MIN,
      max: envVars.DB_POOL_MAX,
    },
  },
  
  redis: {
    url: envVars.REDIS_URL,
    keyPrefix: envVars.REDIS_KEY_PREFIX,
  },
  
  blockchain: {
    chainId: envVars.CHAIN_ID,
    rpcUrl: envVars.RPC_URL,
    permit2Address: envVars.PERMIT2_ADDRESS,
    routerAddress: envVars.ROUTER_ADDRESS,
    settlementContract: envVars.SETTLEMENT_CONTRACT_ADDRESS,
  },
  
  api: {
    rateLimit: {
      windowMs: envVars.API_RATE_LIMIT_WINDOW,
      max: envVars.API_RATE_LIMIT_MAX,
    },
    jwtSecret: envVars.JWT_SECRET,
  },
  
  bidding: {
    windowMs: envVars.BIDDING_WINDOW_MS,
    maxSolverFeeBps: envVars.MAX_SOLVER_FEE_BPS,
    minBidCount: envVars.MIN_BID_COUNT,
  },
  
  websocket: {
    heartbeatInterval: envVars.WS_HEARTBEAT_INTERVAL,
    connectionTimeout: envVars.WS_CONNECTION_TIMEOUT,
  },
  
  logging: {
    level: envVars.LOG_LEVEL,
    filePath: envVars.LOG_FILE_PATH,
    maxFiles: envVars.LOG_MAX_FILES,
    maxSize: envVars.LOG_MAX_SIZE,
  },
  
  monitoring: {
    enabled: envVars.METRICS_ENABLED,
    prometheusPort: envVars.PROMETHEUS_PORT,
  },
  
  development: {
    debug: envVars.ENABLE_DEBUG,
    mockSolver: envVars.MOCK_SOLVER_ENABLED,
  },
  
  security: {
    corsOrigins: envVars.CORS_ORIGINS.split(',').map((origin: string) => origin.trim()),
    helmetEnabled: envVars.HELMET_ENABLED,
  },
  
  external: {
    solverRegistryKey: envVars.SOLVER_REGISTRY_PRIVATE_KEY,
  },
};

export default config;