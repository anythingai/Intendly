/**
 * @fileoverview Main entry point for Intent Solver SDK
 * @description TypeScript SDK for building solvers for Intent-Based Trading Aggregator
 */

// Export all types
export * from './types/index.js';

// Export main client
export { SolverClient } from './client/SolverClient.js';

// Export core components
export { IntentListener } from './websocket/IntentListener.js';
export { BidManager } from './bid/BidManager.js';
export { QuoteAggregator } from './quotes/QuoteAggregator.js';
export { AuthManager } from './auth/AuthManager.js';
export { PerformanceMonitor } from './monitoring/PerformanceMonitor.js';

// Export strategies
export { BaseBidStrategy } from './strategies/BaseBidStrategy.js';
export { AggressiveStrategy } from './strategies/AggressiveStrategy.js';
export { ConservativeStrategy } from './strategies/ConservativeStrategy.js';
export { AdaptiveStrategy } from './strategies/AdaptiveStrategy.js';

// Export quote sources
export { OneInchSource } from './quotes/sources/OneInchSource.js';
export { ParaSwapSource } from './quotes/sources/ParaSwapSource.js';
export { UniswapV3Source } from './quotes/sources/UniswapV3Source.js';

// Legacy export for backward compatibility
export { SolverClient as SolverSDK } from './client/SolverClient.js';

// Export default
export { SolverClient as default } from './client/SolverClient.js';

// Version info
export const VERSION = '0.1.0';
export const SDK_NAME = 'Intent Solver SDK';

/**
 * SDK initialization helper
 * @returns Basic SDK info
 */
export function getSDKInfo() {
  return {
    name: SDK_NAME,
    version: VERSION,
    description: 'TypeScript SDK for building solvers for Intent-Based Trading Aggregator',
    status: 'production',
  };
}