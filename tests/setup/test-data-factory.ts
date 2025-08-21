/**
 * @fileoverview Test data factory for generating realistic test data
 * @description Provides factory functions for creating test intents, bids, and other data
 */

// Simple random generation for testing
const randomBytes = (length: number) => {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return {
    toString: (encoding: string) => {
      if (encoding === 'hex') {
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      }
      return bytes.toString();
    }
  };
};
import type { Intent, CreateIntentRequest } from '../../shared/types/intent.js';
import type { Bid, BidLike, BidSubmission } from '../../shared/types/bid.js';
import { testTokens, testConfig } from './test-config.js';

export interface TestIntent extends Intent {
  signature?: string;
  signer?: string;
}

export interface TestBid extends BidSubmission {
  signature?: string;
  createdAt?: Date;
}

/**
 * Generate a random Ethereum address
 */
export const generateRandomAddress = (): string => {
  return '0x' + randomBytes(20).toString('hex');
};

/**
 * Generate a random hash
 */
export const generateRandomHash = (): string => {
  return '0x' + randomBytes(32).toString('hex');
};

/**
 * Generate a mock signature
 */
export const generateMockSignature = (): string => {
  return '0x' + randomBytes(65).toString('hex');
};

/**
 * Create a test intent with realistic parameters
 */
export const createTestIntent = (overrides: Partial<TestIntent> = {}): TestIntent => {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    tokenIn: testTokens.WETH,
    tokenOut: testTokens.USDC,
    amountIn: '1000000000000000000', // 1 ETH
    maxSlippageBps: 300, // 3%
    deadline: (now + 3600).toString(), // 1 hour from now
    chainId: testConfig.blockchain.chainId.toString(),
    receiver: generateRandomAddress(),
    nonce: Math.floor(Math.random() * 1000000).toString(),
    signature: generateMockSignature(),
    signer: generateRandomAddress(),
    ...overrides
  };
};

/**
 * Create a test bid with realistic parameters
 */
export const createTestBid = (intentHash?: string, overrides: Partial<TestBid> = {}): TestBid => {
  return {
    intentHash: intentHash || generateRandomHash(),
    quoteOut: '990000000000000000', // 0.99 ETH worth of USDC
    solverFeeBps: 10, // 0.1%
    calldataHint: '0x' + randomBytes(100).toString('hex'),
    ttlMs: 3000,
    solverSig: generateMockSignature(),
    signature: generateMockSignature(),
    createdAt: new Date(),
    ...overrides
  };
};

/**
 * Create a complete intent request for API testing
 */
export const createIntentRequest = (overrides: Partial<CreateIntentRequest> = {}): CreateIntentRequest => {
  const intent = createTestIntent();
  return {
    intent: {
      tokenIn: intent.tokenIn,
      tokenOut: intent.tokenOut,
      amountIn: intent.amountIn,
      maxSlippageBps: intent.maxSlippageBps,
      deadline: intent.deadline,
      chainId: intent.chainId,
      receiver: intent.receiver,
      nonce: intent.nonce
    },
    signature: intent.signature!,
    ...overrides
  };
};

/**
 * Create multiple test intents for load testing
 */
export const createMultipleIntents = (count: number, overrides: Partial<TestIntent> = {}): TestIntent[] => {
  return Array.from({ length: count }, (_, i) => 
    createTestIntent({ 
      nonce: (i + 1).toString(),
      ...overrides 
    })
  );
};

/**
 * Create multiple test bids for competition testing
 */
export const createMultipleBids = (intentHash: string, count: number): TestBid[] => {
  return Array.from({ length: count }, (_, i) => {
    const baseQuote = BigInt('990000000000000000');
    const variation = BigInt(i * 1000000000000000); // Small variations
    
    return createTestBid(intentHash, {
      quoteOut: (baseQuote + variation).toString(),
      solverFeeBps: 10 + i, // Varying fees
    });
  });
};

/**
 * Create test data for different trading pairs
 */
export const createTradingPairIntents = (): Record<string, TestIntent> => {
  return {
    'ETH-USDC': createTestIntent({
      tokenIn: testTokens.WETH,
      tokenOut: testTokens.USDC,
      amountIn: '1000000000000000000', // 1 ETH
    }),
    'USDC-ETH': createTestIntent({
      tokenIn: testTokens.USDC,
      tokenOut: testTokens.WETH,
      amountIn: '3000000000', // 3000 USDC
    }),
    'USDT-DAI': createTestIntent({
      tokenIn: testTokens.USDT,
      tokenOut: testTokens.DAI,
      amountIn: '1000000000', // 1000 USDT
    }),
    'DAI-USDC': createTestIntent({
      tokenIn: testTokens.DAI,
      tokenOut: testTokens.USDC,
      amountIn: '2000000000000000000000', // 2000 DAI
    })
  };
};

/**
 * Create test data for edge cases
 */
export const createEdgeCaseIntents = (): Record<string, TestIntent> => {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    'expired': createTestIntent({
      deadline: (now - 3600).toString(), // Expired 1 hour ago
    }),
    'very-small-amount': createTestIntent({
      amountIn: '1000', // Very small amount
    }),
    'very-large-amount': createTestIntent({
      amountIn: '1000000000000000000000', // 1000 ETH
    }),
    'zero-slippage': createTestIntent({
      maxSlippageBps: 0, // No slippage tolerance
    }),
    'max-slippage': createTestIntent({
      maxSlippageBps: 500, // 5% max slippage
    }),
    'near-deadline': createTestIntent({
      deadline: (now + 60).toString(), // Expires in 1 minute
    })
  };
};

/**
 * Create test data for performance testing
 */
export const createPerformanceTestData = () => {
  const intents = createMultipleIntents(100);
  const intentBids = intents.map(intent => ({
    intent,
    bids: createMultipleBids(generateRandomHash(), 5)
  }));
  
  return {
    intents,
    intentBids,
    totalBids: intentBids.reduce((sum, item) => sum + item.bids.length, 0)
  };
};

/**
 * Create mock blockchain transaction data
 */
export const createMockTransaction = (overrides: any = {}) => {
  return {
    hash: generateRandomHash(),
    blockNumber: Math.floor(Math.random() * 1000000),
    gasUsed: BigInt(Math.floor(Math.random() * 200000) + 21000),
    gasPrice: BigInt('20000000000'), // 20 gwei
    status: 1,
    from: generateRandomAddress(),
    to: generateRandomAddress(),
    value: BigInt('0'),
    ...overrides
  };
};

/**
 * Create mock WebSocket message data
 */
export const createMockWebSocketMessage = (type: string, data: any = {}) => {
  return {
    type,
    timestamp: Date.now(),
    data,
    id: generateRandomHash()
  };
};

/**
 * Create test user accounts with different characteristics
 */
export const createTestUsers = () => {
  return {
    'regular-user': {
      address: generateRandomAddress(),
      privateKey: '0x' + randomBytes(32).toString('hex'),
      balance: {
        ETH: '10000000000000000000', // 10 ETH
        USDC: '50000000000', // 50,000 USDC
      }
    },
    'high-volume-user': {
      address: generateRandomAddress(),
      privateKey: '0x' + randomBytes(32).toString('hex'),
      balance: {
        ETH: '1000000000000000000000', // 1000 ETH
        USDC: '5000000000000', // 5M USDC
      }
    },
    'low-balance-user': {
      address: generateRandomAddress(),
      privateKey: '0x' + randomBytes(32).toString('hex'),
      balance: {
        ETH: '100000000000000000', // 0.1 ETH
        USDC: '100000000', // 100 USDC
      }
    }
  };
};

/**
 * Create test solver configurations
 */
export const createTestSolvers = () => {
  return {
    'aggressive-solver': {
      address: generateRandomAddress(),
      privateKey: '0x' + randomBytes(32).toString('hex'),
      strategy: 'aggressive',
      minFeeBps: 5,
      maxFeeBps: 20,
      bidTimeout: 2000,
    },
    'conservative-solver': {
      address: generateRandomAddress(),
      privateKey: '0x' + randomBytes(32).toString('hex'),
      strategy: 'conservative',
      minFeeBps: 15,
      maxFeeBps: 50,
      bidTimeout: 4000,
    },
    'adaptive-solver': {
      address: generateRandomAddress(),
      privateKey: '0x' + randomBytes(32).toString('hex'),
      strategy: 'adaptive',
      minFeeBps: 5,
      maxFeeBps: 40,
      bidTimeout: 3000,
    }
  };
};