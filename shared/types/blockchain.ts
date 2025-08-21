/**
 * @fileoverview Blockchain-related type definitions
 * @description Types for Web3, smart contracts, and blockchain interactions
 */

// ============================================================================
// Network and Chain Types
// ============================================================================

/**
 * Supported blockchain networks
 */
export interface Network {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isTestnet: boolean;
}

/**
 * X Layer network configurations
 */
export const NETWORKS: Record<string, Network> = {
  xlayer: {
    chainId: 196,
    name: 'X Layer Mainnet',
    symbol: 'OKB',
    rpcUrl: 'https://xlayerrpc.okx.com',
    blockExplorerUrl: 'https://www.oklink.com/xlayer',
    nativeCurrency: {
      name: 'OKB',
      symbol: 'OKB',
      decimals: 18,
    },
    isTestnet: false,
  },
  xlayerTestnet: {
    chainId: 195,
    name: 'X Layer Testnet',
    symbol: 'OKB',
    rpcUrl: 'https://testrpc.xlayer.tech',
    blockExplorerUrl: 'https://www.oklink.com/xlayer-test',
    nativeCurrency: {
      name: 'OKB',
      symbol: 'OKB',
      decimals: 18,
    },
    isTestnet: true,
  },
};

// ============================================================================
// Contract Types
// ============================================================================

/**
 * Contract address registry
 */
export interface ContractAddresses {
  settlementContract: string;
  permit2: string;
  router: string;
  multicall?: string;
  weth?: string;
}

/**
 * Contract deployment info
 */
export interface ContractDeployment {
  address: string;
  blockNumber: number;
  transactionHash: string;
  deployedAt: Date;
  verified: boolean;
  constructor?: {
    args: any[];
    signature: string;
  };
}

// ============================================================================
// Token Types
// ============================================================================

/**
 * ERC20 token information
 */
export interface Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoUri?: string;
  chainId: number;
  isNative?: boolean;
  tags?: string[];
}

/**
 * Token balance information
 */
export interface TokenBalance {
  token: Token;
  balance: string; // Raw balance in wei
  formattedBalance: string; // Human readable balance
  usdValue?: number;
  lastUpdated: Date;
}

/**
 * Token pair information
 */
export interface TokenPair {
  tokenA: Token;
  tokenB: Token;
  liquidityUsd?: number;
  volume24h?: number;
  priceRatio?: number;
  fee?: number; // in basis points
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Transaction parameters
 */
export interface TransactionParams {
  to: string;
  data: string;
  value?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  type?: number; // EIP-1559 transaction type
}

/**
 * Transaction receipt information
 */
export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  gasUsed: string;
  effectiveGasPrice: string;
  status: 'success' | 'failed';
  logs: TransactionLog[];
  timestamp: Date;
}

/**
 * Transaction log (event)
 */
export interface TransactionLog {
  address: string;
  topics: string[];
  data: string;
  logIndex: number;
  transactionIndex: number;
  removed: boolean;
}

/**
 * Gas estimation result
 */
export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCost: string; // in wei
  estimatedCostUsd?: number;
  confidence: number; // 0-100
}

// ============================================================================
// Wallet and Account Types
// ============================================================================

/**
 * Wallet connection state
 */
export interface WalletState {
  isConnected: boolean;
  address?: string;
  chainId?: number;
  balance?: string;
  connector?: string; // 'metamask', 'walletconnect', etc.
}

/**
 * Account information
 */
export interface Account {
  address: string;
  chainId: number;
  balance: string;
  nonce: number;
  tokens: TokenBalance[];
  lastActivity?: Date;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Smart contract event
 */
export interface ContractEvent {
  eventName: string;
  address: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  args: Record<string, any>;
  timestamp: Date;
}

/**
 * Intent settlement event (from smart contract)
 */
export interface IntentFilledEvent extends ContractEvent {
  eventName: 'IntentFilled';
  args: {
    intentHash: string;
    user: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    solver: string;
    fee: string;
  };
}

// ============================================================================
// Block and Chain Data
// ============================================================================

/**
 * Block information
 */
export interface Block {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  gasLimit: string;
  gasUsed: string;
  miner: string;
  difficulty: string;
  totalDifficulty: string;
  transactions: string[]; // transaction hashes
}

/**
 * Chain state information
 */
export interface ChainState {
  blockNumber: number;
  blockTimestamp: number;
  gasPrice: string;
  baseFee?: string;
  nextBaseFee?: string;
  pendingTransactions: number;
  networkCongestion: 'low' | 'medium' | 'high';
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Ethereum address type for better type safety
 */
export type Address = string & { readonly brand: unique symbol };

/**
 * Helper to create typed address
 */
export const createAddress = (address: string): Address => address as Address;

/**
 * Transaction hash type
 */
export type TransactionHash = string & { readonly brand: unique symbol };

/**
 * Helper to create typed transaction hash
 */
export const createTransactionHash = (hash: string): TransactionHash => hash as TransactionHash;

/**
 * Block hash type
 */
export type BlockHash = string & { readonly brand: unique symbol };

/**
 * Helper to create typed block hash
 */
export const createBlockHash = (hash: string): BlockHash => hash as BlockHash;

/**
 * Wei amount type for precise token amounts
 */
export type Wei = string & { readonly brand: unique symbol };

/**
 * Helper to create typed wei amount
 */
export const createWei = (amount: string): Wei => amount as Wei;