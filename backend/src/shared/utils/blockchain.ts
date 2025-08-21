/**
 * @fileoverview Blockchain integration utilities
 * @description Handles contract interactions and blockchain operations
 */

import { createPublicClient, createWalletClient, http, parseAbi, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import config from '../config/index.js';

// Intent Settlement contract ABI (simplified)
const INTENT_SETTLEMENT_ABI = parseAbi([
  'function fillIntent(bytes32 intentHash, (address solver, uint256 quoteOut, uint16 solverFeeBps, bytes calldataHint) bid, bytes signature) external',
  'function getIntentStatus(bytes32 intentHash) external view returns (uint8)',
  'function validateBid(bytes32 intentHash, (address solver, uint256 quoteOut, uint16 solverFeeBps, bytes calldataHint) bid) external view returns (bool)',
  'event IntentFilled(bytes32 indexed intentHash, address indexed solver, uint256 amountOut, uint16 solverFeeBps)',
  'event IntentCreated(bytes32 indexed intentHash, address indexed signer)',
]);

// Permit2 contract ABI (simplified)
const PERMIT2_ABI = parseAbi([
  'function allowance(address owner, address token, address spender) external view returns (uint160 amount, uint48 expiration, uint48 nonce)',
  'function permit(address owner, (address token, uint160 amount, uint48 expiration, uint48 nonce) permitSingle, bytes calldata signature) external',
]);

export interface ContractInteractionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  gasUsed?: bigint;
}

export interface IntentFillResult extends ContractInteractionResult {
  amountOut?: string;
  solverFeePaid?: string;
  blockNumber?: bigint;
}

export class BlockchainService {
  private publicClient: any;
  private walletClient: any;
  private settlementContract: any;
  private permit2Contract: any;

  constructor() {
    // Public client for reading blockchain state
    this.publicClient = createPublicClient({
      transport: http(config.blockchain.rpcUrl),
    });

    // Wallet client for sending transactions (if private key provided)
    if (config.external.solverRegistryKey) {
      const account = privateKeyToAccount(config.external.solverRegistryKey as `0x${string}`);
      this.walletClient = createWalletClient({
        account,
        transport: http(config.blockchain.rpcUrl),
      });
    }

    // Contract instances
    this.settlementContract = getContract({
      address: config.blockchain.settlementContract as `0x${string}`,
      abi: INTENT_SETTLEMENT_ABI,
      client: this.publicClient,
    });

    this.permit2Contract = getContract({
      address: config.blockchain.permit2Address as `0x${string}`,
      abi: PERMIT2_ABI,
      client: this.publicClient,
    });
  }

  /**
   * Get intent status from contract
   */
  async getIntentStatus(intentHash: string): Promise<number | null> {
    try {
      const status = await this.settlementContract.read.getIntentStatus([intentHash as `0x${string}`]);
      return Number(status);
    } catch (error) {
      console.error('Failed to get intent status:', error);
      return null;
    }
  }

  /**
   * Validate bid against contract
   */
  async validateBid(intentHash: string, bid: any): Promise<boolean> {
    try {
      const isValid = await this.settlementContract.read.validateBid([
        intentHash as `0x${string}`,
        {
          solver: bid.solver as `0x${string}`,
          quoteOut: BigInt(bid.quoteOut),
          solverFeeBps: bid.solverFeeBps,
          calldataHint: bid.calldataHint as `0x${string}`,
        }
      ]);
      return Boolean(isValid);
    } catch (error) {
      console.error('Failed to validate bid:', error);
      return false;
    }
  }

  /**
   * Fill intent with winning bid
   */
  async fillIntent(
    intentHash: string,
    bid: any,
    signature: string
  ): Promise<IntentFillResult> {
    if (!this.walletClient) {
      return {
        success: false,
        error: 'No wallet client configured'
      };
    }

    try {
      // Prepare transaction
      const { request } = await this.publicClient.simulateContract({
        account: this.walletClient.account,
        address: config.blockchain.settlementContract as `0x${string}`,
        abi: INTENT_SETTLEMENT_ABI,
        functionName: 'fillIntent',
        args: [
          intentHash as `0x${string}`,
          {
            solver: bid.solver as `0x${string}`,
            quoteOut: BigInt(bid.quoteOut),
            solverFeeBps: bid.solverFeeBps,
            calldataHint: bid.calldataHint as `0x${string}`,
          },
          signature as `0x${string}`
        ],
      });

      // Send transaction
      const txHash = await this.walletClient.writeContract(request);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      // Parse logs for intent filled event
      const intentFilledLog = receipt.logs.find((log: any) => 
        log.topics[0] === '0x...' // IntentFilled event signature
      );

      let amountOut, solverFeePaid;
      if (intentFilledLog) {
        // Parse event data
        // amountOut = ...
        // solverFeePaid = ...
      }

      return {
        success: receipt.status === 'success',
        txHash,
        gasUsed: receipt.gasUsed,
        amountOut: amountOut?.toString(),
        solverFeePaid: solverFeePaid?.toString(),
        blockNumber: receipt.blockNumber,
      };

    } catch (error) {
      console.error('Failed to fill intent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check token allowance via Permit2
   */
  async getTokenAllowance(
    owner: string,
    token: string,
    spender: string
  ): Promise<{
    amount: bigint;
    expiration: number;
    nonce: number;
  } | null> {
    try {
      const result = await this.permit2Contract.read.allowance([
        owner as `0x${string}`,
        token as `0x${string}`,
        spender as `0x${string}`
      ]);

      return {
        amount: result[0],
        expiration: Number(result[1]),
        nonce: Number(result[2])
      };
    } catch (error) {
      console.error('Failed to get token allowance:', error);
      return null;
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<bigint | null> {
    try {
      const blockNumber = await this.publicClient.getBlockNumber();
      return blockNumber;
    } catch (error) {
      console.error('Failed to get current block:', error);
      return null;
    }
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<any> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`
      });
      return receipt;
    } catch (error) {
      console.error('Failed to get transaction receipt:', error);
      return null;
    }
  }

  /**
   * Estimate gas for intent fill
   */
  async estimateFillGas(
    intentHash: string,
    bid: any,
    signature: string
  ): Promise<bigint | null> {
    try {
      const gasEstimate = await this.publicClient.estimateContractGas({
        address: config.blockchain.settlementContract as `0x${string}`,
        abi: INTENT_SETTLEMENT_ABI,
        functionName: 'fillIntent',
        args: [
          intentHash as `0x${string}`,
          {
            solver: bid.solver as `0x${string}`,
            quoteOut: BigInt(bid.quoteOut),
            solverFeeBps: bid.solverFeeBps,
            calldataHint: bid.calldataHint as `0x${string}`,
          },
          signature as `0x${string}`
        ],
      });

      return gasEstimate;
    } catch (error) {
      console.error('Failed to estimate gas:', error);
      return null;
    }
  }

  /**
   * Get gas price
   */
  async getGasPrice(): Promise<bigint | null> {
    try {
      const gasPrice = await this.publicClient.getGasPrice();
      return gasPrice;
    } catch (error) {
      console.error('Failed to get gas price:', error);
      return null;
    }
  }

  /**
   * Health check for blockchain connection
   */
  async healthCheck(): Promise<{ status: string; blockNumber?: bigint; latency?: number }> {
    try {
      const start = Date.now();
      const blockNumber = await this.getCurrentBlock();
      const latency = Date.now() - start;

      if (blockNumber === null) {
        return { status: 'unhealthy' };
      }

      return {
        status: 'healthy',
        blockNumber,
        latency
      };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }

  /**
   * Listen for contract events
   */
  async watchIntentEvents(callback: (event: any) => void): Promise<void> {
    try {
      this.publicClient.watchContractEvent({
        address: config.blockchain.settlementContract,
        abi: INTENT_SETTLEMENT_ABI,
        eventName: 'IntentFilled',
        onLogs: (logs: any[]) => {
          logs.forEach(callback);
        },
      });
    } catch (error) {
      console.error('Failed to watch contract events:', error);
    }
  }
}

// Singleton instance
export const blockchainService = new BlockchainService();

export default blockchainService;