/**
 * @fileoverview Configuration for Reference Solver
 * @description Environment-based configuration for the solver
 */

import type { SolverConfig } from '../../src/types/index.js';

// Load environment variables with defaults
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
};

export const config: SolverConfig = {
  // Core configuration
  solverPrivateKey: getEnvVar('SOLVER_PRIVATE_KEY'),
  coordinatorUrl: getEnvVar('COORDINATOR_URL', 'http://localhost:3001'),
  wsUrl: getEnvVar('WS_URL', 'ws://localhost:3002'),
  chainId: parseInt(getEnvVar('CHAIN_ID', '196')), // X Layer by default
  rpcUrl: getEnvVar('RPC_URL'),
  settlementContract: getEnvVar('SETTLEMENT_CONTRACT'),

  // Performance settings
  maxResponseTimeMs: parseInt(getEnvVar('MAX_RESPONSE_TIME_MS', '2000')),
  maxConcurrentBids: parseInt(getEnvVar('MAX_CONCURRENT_BIDS', '10')),
  retryAttempts: parseInt(getEnvVar('RETRY_ATTEMPTS', '3')),
  retryDelayMs: parseInt(getEnvVar('RETRY_DELAY_MS', '500')),
  enablePerformanceMonitoring: getEnvVar('ENABLE_PERFORMANCE_MONITORING', 'true') === 'true',
  enableAutoReconnect: getEnvVar('ENABLE_AUTO_RECONNECT', 'true') === 'true',
  heartbeatIntervalMs: parseInt(getEnvVar('HEARTBEAT_INTERVAL_MS', '30000')),

  // Quote source configuration
  quoteSources: {
    oneInch: {
      enabled: getEnvVar('ONEINCH_ENABLED', 'true') === 'true',
      apiKey: getEnvVar('ONEINCH_API_KEY', '')
    },
    paraSwap: {
      enabled: getEnvVar('PARASWAP_ENABLED', 'true') === 'true',
      apiKey: getEnvVar('PARASWAP_API_KEY', '')
    },
    uniswapV3: {
      enabled: getEnvVar('UNISWAP_V3_ENABLED', 'true') === 'true'
    }
  }
};

// Validation
if (!config.solverPrivateKey || config.solverPrivateKey.length < 10) {
  console.warn('⚠️  Warning: SOLVER_PRIVATE_KEY not properly configured');
}

if (!config.rpcUrl && config.quoteSources?.uniswapV3?.enabled) {
  console.warn('⚠️  Warning: RPC_URL required for Uniswap V3 integration');
}

console.log('📋 Configuration loaded:');
console.log(`   Chain ID: ${config.chainId}`);
console.log(`   Coordinator: ${config.coordinatorUrl}`);
console.log(`   WebSocket: ${config.wsUrl}`);
console.log(`   Quote Sources: ${Object.entries(config.quoteSources || {})
  .filter(([_, config]) => config.enabled)
  .map(([name]) => name)
  .join(', ')}`);