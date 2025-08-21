/**
 * @fileoverview Centralized test configuration
 * @description Configuration for all test environments and utilities
 */

export interface TestConfig {
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  redis: {
    url: string;
  };
  blockchain: {
    rpcUrl: string;
    chainId: number;
    accounts: {
      mnemonic: string;
      count: number;
    };
  };
  services: {
    relayer: {
      url: string;
      port: number;
    };
    coordinator: {
      url: string;
      port: number;
    };
    websocket: {
      url: string;
      port: number;
    };
  };
  contracts: {
    settlementAddress?: string;
    permit2Address: string;
    routerAddress?: string;
  };
  timeouts: {
    default: number;
    integration: number;
    e2e: number;
    load: number;
  };
  performance: {
    maxIntentProcessingTime: number;
    maxBidCollectionTime: number;
    maxSettlementTime: number;
    maxWebSocketLatency: number;
    maxDatabaseQueryTime: number;
  };
}

export const testConfig: TestConfig = {
  database: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433'),
    name: process.env.TEST_DB_NAME || 'intendly_test',
    user: process.env.TEST_DB_USER || 'test_user',
    password: process.env.TEST_DB_PASSWORD || 'test_password',
    ssl: false
  },
  redis: {
    url: process.env.TEST_REDIS_URL || 'redis://localhost:6380'
  },
  blockchain: {
    rpcUrl: process.env.TEST_BLOCKCHAIN_RPC_URL || 'http://localhost:8545',
    chainId: parseInt(process.env.TEST_CHAIN_ID || '31337'),
    accounts: {
      mnemonic: process.env.TEST_MNEMONIC || 'test test test test test test test test test test test junk',
      count: 20
    }
  },
  services: {
    relayer: {
      url: process.env.TEST_RELAYER_URL || 'http://localhost:3004',
      port: parseInt(process.env.TEST_RELAYER_PORT || '3004')
    },
    coordinator: {
      url: process.env.TEST_COORDINATOR_URL || 'http://localhost:3005',
      port: parseInt(process.env.TEST_COORDINATOR_PORT || '3005')
    },
    websocket: {
      url: process.env.TEST_WS_URL || 'ws://localhost:3003',
      port: parseInt(process.env.TEST_WS_PORT || '3003')
    }
  },
  contracts: {
    permit2Address: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    // Settlement and router addresses will be set during test setup
  },
  timeouts: {
    default: 30000, // 30s
    integration: 60000, // 1m
    e2e: 120000, // 2m
    load: 300000 // 5m
  },
  performance: {
    maxIntentProcessingTime: 500, // 500ms
    maxBidCollectionTime: 3000, // 3s
    maxSettlementTime: 30000, // 30s
    maxWebSocketLatency: 100, // 100ms
    maxDatabaseQueryTime: 50 // 50ms
  }
};

export const getTestAccountPrivateKey = (index: number = 0): string => {
  // Anvil default private keys for testing
  const defaultKeys = [
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Account 0
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // Account 1
    '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', // Account 2
    '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', // Account 3
    '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a', // Account 4
  ];
  
  if (index < defaultKeys.length) {
    return defaultKeys[index];
  }
  
  throw new Error(`Test account index ${index} not available`);
};

export const testTokens = {
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  USDC: '0xA0b86a33E6417b7b5c1eC7E0AA5d4aFe5B40FAbE',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
} as const;

export const isCI = process.env.CI === 'true';
export const isVerbose = process.env.VERBOSE === 'true';
export const skipSlowTests = process.env.SKIP_SLOW_TESTS === 'true';