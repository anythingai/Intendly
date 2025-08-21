/**
 * @fileoverview Wallet-related type definitions
 * @description Types for wallet connection, network management, and Web3 interactions
 */

import { Address, Chain } from 'viem';

// ============================================================================
// Wallet Connection Types
// ============================================================================

export interface WalletState {
  address?: Address;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  chainId?: number;
  connector?: any;
}

export interface ConnectorInfo {
  id: string;
  name: string;
  icon?: string;
  installed?: boolean;
  downloadUrl?: string;
}

// ============================================================================
// Network Types
// ============================================================================

export interface NetworkConfig {
  id: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  testnet?: boolean;
}

export interface ChainInfo extends Chain {
  icon?: string;
  color?: string;
}

// ============================================================================
// Transaction Types
// ============================================================================

export interface TransactionRequest {
  to: Address;
  data?: `0x${string}`;
  value?: bigint;
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

export interface TransactionReceipt {
  hash: `0x${string}`;
  blockNumber: bigint;
  blockHash: `0x${string}`;
  transactionIndex: number;
  from: Address;
  to: Address;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  status: 'success' | 'reverted';
  logs: any[];
}

export interface PendingTransaction {
  hash: `0x${string}`;
  type: 'intent' | 'settlement' | 'approval';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  description: string;
}

// ============================================================================
// Balance Types
// ============================================================================

export interface TokenBalance {
  address: Address;
  symbol: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  usdValue?: string;
}

export interface BalanceState {
  balances: Record<Address, TokenBalance>;
  isLoading: boolean;
  lastUpdated?: number;
}

// ============================================================================
// Permission Types
// ============================================================================

export interface PermissionRequest {
  type: 'signature' | 'transaction' | 'switchChain';
  data: any;
  description: string;
}

export interface SignatureRequest extends PermissionRequest {
  type: 'signature';
  data: {
    domain: any;
    types: any;
    primaryType: string;
    message: any;
  };
}