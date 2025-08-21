/**
 * @fileoverview Wagmi configuration for Web3 integration
 * @description Sets up wagmi v2 with X Layer support and wallet connectors
 */

import { http, createConfig } from 'wagmi';
import { xLayer, xLayerTestnet } from 'wagmi/chains';
import { injected, metaMask, walletConnect } from 'wagmi/connectors';

// ============================================================================
// Chain Configuration
// ============================================================================

// X Layer Mainnet configuration
const xLayerMainnet = {
  ...xLayer,
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_RPC_URL || 'https://xlayerrpc.okx.com',
        'https://rpc.xlayer.tech',
        'https://xlayerrpc.okx.com'
      ]
    },
    public: {
      http: [
        'https://xlayerrpc.okx.com',
        'https://rpc.xlayer.tech'
      ]
    }
  },
  blockExplorers: {
    default: {
      name: 'X Layer Explorer',
      url: 'https://www.okx.com/web3/explorer/xlayer'
    }
  }
};

// X Layer Testnet configuration  
const xLayerTest = {
  ...xLayerTestnet,
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_TESTNET_RPC_URL || 'https://testrpc.xlayer.tech',
        'https://testrpc.xlayer.tech'
      ]
    },
    public: {
      http: ['https://testrpc.xlayer.tech']
    }
  },
  blockExplorers: {
    default: {
      name: 'X Layer Testnet Explorer',
      url: 'https://www.okx.com/web3/explorer/xlayer-test'
    }
  }
};

// ============================================================================
// Connector Configuration
// ============================================================================

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!walletConnectProjectId) {
  console.warn('WalletConnect Project ID not found. WalletConnect will not be available.');
}

// Configure connectors
const connectors = [
  // MetaMask connector
  metaMask({
    dappMetadata: {
      name: 'Intent Trading Aggregator',
      url: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      iconUrl: '/favicon.ico'
    }
  }),
  
  // Injected connector (for other wallets)
  injected({
    shimDisconnect: true
  }),
  
  // WalletConnect connector (only if project ID is available)
  ...(walletConnectProjectId ? [
    walletConnect({
      projectId: walletConnectProjectId,
      metadata: {
        name: 'Intent Trading Aggregator',
        description: 'Intent-based trading aggregator for optimal DeFi execution',
        url: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        icons: [`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/favicon.ico`]
      },
      showQrModal: true
    })
  ] : [])
];

// ============================================================================
// Chain Selection
// ============================================================================

// Determine which chains to support based on environment
const supportedChains = process.env.NODE_ENV === 'development' 
  ? [xLayerMainnet, xLayerTest]
  : [xLayerMainnet];

// Parse supported chain IDs from environment
const envChainIds = process.env.NEXT_PUBLIC_SUPPORTED_CHAINS?.split(',').map(id => parseInt(id.trim()));
const chains = envChainIds?.length 
  ? supportedChains.filter(chain => envChainIds.includes(chain.id))
  : supportedChains;

// ============================================================================
// Wagmi Configuration
// ============================================================================

export const wagmiConfig = createConfig({
  chains: chains as any,
  connectors,
  transports: {
    [xLayerMainnet.id]: http(xLayerMainnet.rpcUrls.default.http[0]),
    [xLayerTest.id]: http(xLayerTest.rpcUrls.default.http[0])
  },
  ssr: true, // Enable SSR support for Next.js
  batch: {
    multicall: true
  },
  pollingInterval: 4000, // Poll every 4 seconds
});

// ============================================================================
// Network Utils
// ============================================================================

export const getDefaultChain = () => {
  const defaultChainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '196');
  return chains.find(chain => chain.id === defaultChainId) || chains[0];
};

export const getChainById = (chainId: number) => {
  return chains.find(chain => chain.id === chainId);
};

export const isTestnet = (chainId: number) => {
  return chainId === xLayerTest.id;
};

export const getExplorerUrl = (chainId: number, hash?: string, type: 'tx' | 'address' | 'block' = 'tx') => {
  const chain = getChainById(chainId);
  if (!chain?.blockExplorers?.default) return null;
  
  const baseUrl = chain.blockExplorers.default.url;
  if (!hash) return baseUrl;
  
  switch (type) {
    case 'tx':
      return `${baseUrl}/tx/${hash}`;
    case 'address':
      return `${baseUrl}/address/${hash}`;
    case 'block':
      return `${baseUrl}/block/${hash}`;
    default:
      return `${baseUrl}/tx/${hash}`;
  }
};

// ============================================================================
// Contract Addresses
// ============================================================================

export const getContractAddresses = (chainId: number) => {
  const isTest = isTestnet(chainId);
  
  return {
    settlement: process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT || '0x0000000000000000000000000000000000000000',
    permit2: process.env.NEXT_PUBLIC_PERMIT2_ADDRESS || '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    // Add more contract addresses as needed
  };
};

// ============================================================================
// Token Lists
// ============================================================================

export const getTokenList = (chainId: number) => {
  const isTest = isTestnet(chainId);
  
  // Base tokens for X Layer
  const baseTokens = [
    {
      address: '0x0000000000000000000000000000000000000000', // Native ETH
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      logoURI: '/tokens/eth.svg',
      isNative: true,
      isPopular: true
    },
    {
      address: process.env.NEXT_PUBLIC_WETH_ADDRESS || '0x5A77f1443D16ee5761b7fcE4ad9B88E4C01BF7af',
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
      decimals: 18,
      logoURI: '/tokens/weth.svg',
      isPopular: true
    },
    {
      address: process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x74b7F16337b8972027F6196A17a631aC6dE26d22',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logoURI: '/tokens/usdc.svg',
      isPopular: true
    },
    {
      address: process.env.NEXT_PUBLIC_USDT_ADDRESS || '0x1E4a5963aBFD975d8c9021ce480b42188849D41d',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      logoURI: '/tokens/usdt.svg',
      isPopular: true
    }
  ];
  
  return baseTokens.map(token => ({
    ...token,
    chainId,
    isTestnet: isTest
  }));
};

// ============================================================================
// Configuration Validation
// ============================================================================

export const validateConfig = () => {
  const errors: string[] = [];
  
  if (!process.env.NEXT_PUBLIC_CHAIN_ID) {
    errors.push('NEXT_PUBLIC_CHAIN_ID is required');
  }
  
  if (!process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT || 
      process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT === '0x0000000000000000000000000000000000000000') {
    errors.push('NEXT_PUBLIC_SETTLEMENT_CONTRACT must be set to a valid address');
  }
  
  if (!process.env.NEXT_PUBLIC_API_URL) {
    errors.push('NEXT_PUBLIC_API_URL is required');
  }
  
  if (!process.env.NEXT_PUBLIC_WS_URL) {
    errors.push('NEXT_PUBLIC_WS_URL is required');
  }
  
  if (errors.length > 0) {
    console.error('Wagmi configuration errors:', errors);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Invalid configuration: ${errors.join(', ')}`);
    }
  }
  
  return errors.length === 0;
};

// Validate configuration on module load
if (typeof window !== 'undefined') {
  validateConfig();
}

export { chains, connectors };
export type { Config } from 'wagmi';