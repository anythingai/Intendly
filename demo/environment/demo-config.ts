/**
 * @fileoverview Demo Environment Configuration
 * @description Configuration for demo environment setup and validation
 */

export interface DemoConfig {
  mode: 'development' | 'staging' | 'presentation';
  services: {
    frontend: { url: string; port: number };
    relayer: { url: string; port: number };
    coordinator: { url: string; port: number };
    websocket: { url: string; port: number };
  };
  blockchain: {
    chainId: number;
    rpcUrl: string;
    explorerUrl: string;
    gasLimit: number;
    gasPrice: string;
  };
  contracts: {
    settlementAddress: string;
    permit2Address: string;
    routerAddress: string;
  };
  tokens: {
    WETH: string;
    USDC: string;
    OKB: string;
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  redis: {
    url: string;
    host: string;
    port: number;
  };
  demo: {
    walletAddress: string;
    privateKey: string;
    solverCount: number;
    resetBetweenRuns: boolean;
    timeouts: {
      intentProcessing: number; // PRD: <500ms
      bidCollection: number; // PRD: <3s
      settlement: number; // PRD: <30s
      totalFlow: number; // PRD: <2min
    };
  };
  performance: {
    maxIntentProcessingTime: number;
    maxBidCollectionTime: number;
    maxSettlementTime: number;
    maxWebSocketLatency: number;
    maxDatabaseQueryTime: number;
    minSolverCount: number;
    minPriceImprovement: number; // basis points
    maxSlippage: number; // percentage
    minSuccessRate: number; // percentage
  };
  solvers: {
    instances: Array<{
      id: string;
      name: string;
      strategy: string;
      privateKey: string;
      isActive: boolean;
    }>;
  };
}

// Development configuration
export const developmentConfig: DemoConfig = {
  mode: 'development',
  services: {
    frontend: { url: 'http://localhost:3000', port: 3000 },
    relayer: { url: 'http://localhost:3001', port: 3001 },
    coordinator: { url: 'http://localhost:3001', port: 3001 },
    websocket: { url: 'http://localhost:3002', port: 3002 }
  },
  blockchain: {
    chainId: 31337, // Local Anvil
    rpcUrl: 'http://127.0.0.1:8545',
    explorerUrl: 'http://localhost:8080', // Local explorer
    gasLimit: 500000,
    gasPrice: '20000000000' // 20 gwei
  },
  contracts: {
    settlementAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    permit2Address: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    routerAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
  },
  tokens: {
    WETH: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    USDC: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    OKB: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9'
  },
  database: {
    host: 'localhost',
    port: 5433,
    name: 'intendly_demo',
    user: 'demo_user',
    password: 'demo_password'
  },
  redis: {
    url: 'redis://localhost:6380',
    host: 'localhost',
    port: 6380
  },
  demo: {
    walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    solverCount: 3,
    resetBetweenRuns: true,
    timeouts: {
      intentProcessing: 500,
      bidCollection: 3000,
      settlement: 30000,
      totalFlow: 120000
    }
  },
  performance: {
    maxIntentProcessingTime: 500,
    maxBidCollectionTime: 3000,
    maxSettlementTime: 30000,
    maxWebSocketLatency: 100,
    maxDatabaseQueryTime: 50,
    minSolverCount: 2,
    minPriceImprovement: 20,
    maxSlippage: 0.5,
    minSuccessRate: 99
  },
  solvers: {
    instances: [
      {
        id: 'solver-1',
        name: 'Uniswap V3 Solver',
        strategy: 'uniswap-v3',
        privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
        isActive: true
      },
      {
        id: 'solver-2', 
        name: '1inch Aggregator Solver',
        strategy: '1inch-aggregation',
        privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
        isActive: true
      },
      {
        id: 'solver-3',
        name: 'Multi-DEX Solver',
        strategy: 'multi-dex',
        privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
        isActive: true
      }
    ]
  }
};

// Staging configuration (X Layer Testnet)
export const stagingConfig: DemoConfig = {
  ...developmentConfig,
  mode: 'staging',
  blockchain: {
    chainId: 195, // X Layer Testnet
    rpcUrl: 'https://testrpc.xlayer.tech',
    explorerUrl: 'https://testnet.oklink.com/xlayer',
    gasLimit: 500000,
    gasPrice: '20000000000'
  },
  contracts: {
    settlementAddress: '0x742D35Cc6634C0532925a3b8D6BA4ad2Dc3F6cE8', // Deployed on X Layer testnet
    permit2Address: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    routerAddress: '0x1b81D678ffb9C0263b24A97847620C99d213eB14'
  },
  tokens: {
    WETH: '0xb5d85cbf7cb3ee0d56b3b2f8f9c3e2a1b2c3d4e5',
    USDC: '0xa0b86a33e6441539b6c0d4f5f17bf5d9c2d8e8a9',
    OKB: '0xc6e9d85cbf7cb3ee0d56b3b2f8f9c3e2a1b2c3d4'
  },
  services: {
    frontend: { url: 'https://demo-staging.intendly.xyz', port: 443 },
    relayer: { url: 'https://api-staging.intendly.xyz', port: 443 },
    coordinator: { url: 'https://api-staging.intendly.xyz', port: 443 },
    websocket: { url: 'wss://ws-staging.intendly.xyz', port: 443 }
  }
};

// Production demo configuration (X Layer Mainnet)
export const presentationConfig: DemoConfig = {
  ...stagingConfig,
  mode: 'presentation',
  blockchain: {
    chainId: 196, // X Layer Mainnet
    rpcUrl: 'https://rpc.xlayer.tech',
    explorerUrl: 'https://oklink.com/xlayer',
    gasLimit: 500000,
    gasPrice: '20000000000'
  },
  services: {
    frontend: { url: 'https://app.intendly.xyz', port: 443 },
    relayer: { url: 'https://api.intendly.xyz', port: 443 },
    coordinator: { url: 'https://api.intendly.xyz', port: 443 },
    websocket: { url: 'wss://ws.intendly.xyz', port: 443 }
  },
  demo: {
    ...stagingConfig.demo,
    resetBetweenRuns: false, // Don't reset in production demos
    solverCount: 5 // More solvers in production
  }
};

// Get configuration based on environment
export function getDemoConfig(): DemoConfig {
  const mode = (process.env.DEMO_MODE as DemoConfig['mode']) || 'development';
  
  switch (mode) {
    case 'staging':
      return stagingConfig;
    case 'presentation':
      return presentationConfig;
    default:
      return developmentConfig;
  }
}

// Validation helpers
export function validateDemoConfig(config: DemoConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate required fields
  if (!config.demo.walletAddress || !config.demo.privateKey) {
    errors.push('Demo wallet configuration is missing');
  }
  
  if (config.solvers.instances.length < config.performance.minSolverCount) {
    errors.push(`Insufficient solver instances: ${config.solvers.instances.length} < ${config.performance.minSolverCount}`);
  }
  
  // Validate service URLs
  const services = ['frontend', 'relayer', 'coordinator', 'websocket'];
  for (const service of services) {
    const serviceConfig = config.services[service as keyof typeof config.services];
    if (!serviceConfig.url) {
      errors.push(`Missing URL for ${service} service`);
    }
  }
  
  // Validate contract addresses
  const contracts = ['settlementAddress', 'permit2Address', 'routerAddress'];
  for (const contract of contracts) {
    const address = config.contracts[contract as keyof typeof config.contracts];
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      errors.push(`Invalid ${contract}: ${address}`);
    }
  }
  
  // Validate token addresses
  const tokens = ['WETH', 'USDC', 'OKB'];
  for (const token of tokens) {
    const address = config.tokens[token as keyof typeof config.tokens];
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      errors.push(`Invalid ${token} token address: ${address}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Demo scenario configurations
export interface DemoScenario {
  name: string;
  description: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  maxSlippageBps: number;
  expectedSolvers: number;
  expectedTime: number;
  requirements: {
    minPriceImprovement: number;
    maxSlippage: number;
    minSuccessRate: number;
  };
}

export const demoScenarios: DemoScenario[] = [
  {
    name: 'PRD Standard Demo',
    description: '0.5 ETH → USDC swap with ≤0.5% slippage within 2 minutes',
    tokenIn: 'WETH',
    tokenOut: 'USDC',
    amountIn: '500000000000000000', // 0.5 ETH
    maxSlippageBps: 50, // 0.5%
    expectedSolvers: 2,
    expectedTime: 120000, // 2 minutes
    requirements: {
      minPriceImprovement: 20, // 20 bps
      maxSlippage: 0.5, // 0.5%
      minSuccessRate: 99 // 99%
    }
  },
  {
    name: 'High-Volume Competition',
    description: 'Large 10 ETH swap attracting maximum solver competition',
    tokenIn: 'WETH',
    tokenOut: 'USDC',
    amountIn: '10000000000000000000', // 10 ETH
    maxSlippageBps: 100, // 1%
    expectedSolvers: 3,
    expectedTime: 120000,
    requirements: {
      minPriceImprovement: 25,
      maxSlippage: 1.0,
      minSuccessRate: 95
    }
  },
  {
    name: 'Blue-Chip Reliability',
    description: 'ETH/USDC pair demonstrating 99% success rate',
    tokenIn: 'WETH',
    tokenOut: 'USDC',
    amountIn: '1000000000000000000', // 1 ETH
    maxSlippageBps: 30, // 0.3%
    expectedSolvers: 3,
    expectedTime: 30000,
    requirements: {
      minPriceImprovement: 25,
      maxSlippage: 0.3,
      minSuccessRate: 99
    }
  },
  {
    name: 'Alternative Token Pair',
    description: 'USDC → OKB swap for token diversity demonstration',
    tokenIn: 'USDC',
    tokenOut: 'OKB',
    amountIn: '1000000000', // 1000 USDC
    maxSlippageBps: 100, // 1%
    expectedSolvers: 2,
    expectedTime: 120000,
    requirements: {
      minPriceImprovement: 15,
      maxSlippage: 1.0,
      minSuccessRate: 95
    }
  }
];

export default getDemoConfig;