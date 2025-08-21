/**
 * @fileoverview Main trading interface page
 * @description Complete intent-based trading interface with real-time bidding
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useSignTypedData } from 'wagmi';
import { Button } from '../components/ui/Button.js';
import { IntentForm } from '../components/intent/IntentForm.js';
import { useIntentBids, useRealtimeUpdates } from '../hooks/useWebSocket.js';
import { useToast } from '../lib/providers/AppProviders.js';
import { apiClient } from '../lib/api/client.js';
import { createIntentTypedData } from '../lib/crypto/eip712.js';
import { getContractAddresses, getDefaultChain } from '../lib/wagmi/config.js';
import { formatTokenAmount, formatDuration, truncateAddress } from '../lib/utils/index.js';
import { IntentFormData, Intent, BidLike } from '../types/index.js';

// ============================================================================
// Trading Flow States
// ============================================================================

type TradingStep = 'connect' | 'create' | 'signing' | 'bidding' | 'executing' | 'completed' | 'error';

interface TradingState {
  step: TradingStep;
  intent: Intent | null;
  intentHash: string | null;
  signature: string | null;
  selectedBid: BidLike | null;
  error: string | null;
  txHash: string | null;
}

// ============================================================================
// Wallet Connection Component
// ============================================================================

function WalletConnection() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {address.slice(2, 4).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="font-medium">{truncateAddress(address)}</div>
            <div className="text-sm text-muted-foreground">Connected</div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => disconnect()}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-card rounded-lg border text-center">
      <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
      <p className="text-muted-foreground mb-4">
        Connect your wallet to start trading with intents
      </p>
      <div className="space-y-2">
        {connectors.map((connector) => (
          <Button
            key={connector.id}
            onClick={() => connect({ connector })}
            className="w-full"
            variant="outline"
          >
            Connect {connector.name}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Bid Display Component
// ============================================================================

interface BidDisplayProps {
  intentHash: string;
  onSelectBid: (bid: BidLike) => void;
}

function BidDisplay({ intentHash, onSelectBid }: BidDisplayProps) {
  const { 
    bids, 
    bestBid, 
    totalBids, 
    competitionLevel, 
    biddingWindowOpen, 
    timeRemaining 
  } = useIntentBids(intentHash);

  if (!biddingWindowOpen && totalBids === 0) {
    return (
      <div className="p-6 bg-card rounded-lg border text-center">
        <div className="w-12 h-12 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">Waiting for Solvers</h3>
        <p className="text-muted-foreground">
          Solvers are analyzing your intent and preparing bids...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bidding Status */}
      <div className="p-4 bg-card rounded-lg border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Solver Competition</h3>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
              {totalBids} bids
            </span>
            {biddingWindowOpen && timeRemaining && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-800">
                {formatDuration(timeRemaining)} remaining
              </span>
            )}
          </div>
        </div>
        
        {bestBid && (
          <div className="space-y-2">
            <div className="text-2xl font-bold text-success-600">
              {formatTokenAmount(bestBid.quoteOut, 18, 6)}
            </div>
            <div className="text-sm text-muted-foreground">
              Best output • {((Number(bestBid.solverFeeBps) / 100)).toFixed(2)}% solver fee
            </div>
          </div>
        )}
      </div>

      {/* Bid List */}
      {bids.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">All Bids</h4>
          {bids.map((bid, index) => (
            <div
              key={`${bid.solver}-${index}`}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                bid === bestBid
                  ? 'border-success-500 bg-success-50'
                  : 'border-border hover:bg-accent'
              }`}
              onClick={() => onSelectBid(bid)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {formatTokenAmount(bid.quoteOut, 18, 6)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Solver: {truncateAddress(bid.solver)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {((Number(bid.solverFeeBps) / 100)).toFixed(2)}% fee
                  </div>
                  {bid === bestBid && (
                    <div className="text-xs text-success-600 font-medium">
                      Best Bid
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Execute Button */}
      {bestBid && !biddingWindowOpen && (
        <Button
          onClick={() => onSelectBid(bestBid)}
          className="w-full"
          size="lg"
        >
          Execute Best Bid
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Transaction Status Component
// ============================================================================

interface TransactionStatusProps {
  step: TradingStep;
  txHash: string | null;
  error: string | null;
  onReset: () => void;
}

function TransactionStatus({ step, txHash, error, onReset }: TransactionStatusProps) {
  const defaultChain = getDefaultChain();
  
  if (error) {
    return (
      <div className="p-6 bg-card rounded-lg border text-center">
        <div className="w-12 h-12 mx-auto mb-4 bg-error-100 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-error-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2 text-error-600">Transaction Failed</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={onReset} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (step === 'completed' && txHash) {
    return (
      <div className="p-6 bg-card rounded-lg border text-center">
        <div className="w-12 h-12 mx-auto mb-4 bg-success-100 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2 text-success-600">Trade Completed!</h3>
        <p className="text-muted-foreground mb-4">
          Your intent has been successfully executed
        </p>
        <div className="space-y-2">
          <a
            href={`${defaultChain.blockExplorers?.default.url}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-primary hover:text-primary/80"
          >
            <span>View on Explorer</span>
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
        <Button onClick={onReset} className="mt-4">
          Start New Trade
        </Button>
      </div>
    );
  }

  if (step === 'executing') {
    return (
      <div className="p-6 bg-card rounded-lg border text-center">
        <div className="w-12 h-12 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="m12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">Executing Trade</h3>
        <p className="text-muted-foreground">
          Processing your transaction on the blockchain...
        </p>
      </div>
    );
  }

  return null;
}

// ============================================================================
// Main Trading Interface
// ============================================================================

export default function TradingPage() {
  const { address, isConnected, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { addToast } = useToast();
  
  const [tradingState, setTradingState] = useState<TradingState>({
    step: 'connect',
    intent: null,
    intentHash: null,
    signature: null,
    selectedBid: null,
    error: null,
    txHash: null
  });

  // Update step based on wallet connection
  useEffect(() => {
    if (!isConnected) {
      setTradingState(prev => ({ ...prev, step: 'connect' }));
    } else if (tradingState.step === 'connect') {
      setTradingState(prev => ({ ...prev, step: 'create' }));
    }
  }, [isConnected, tradingState.step]);

  // Handle intent creation
  const handleCreateIntent = useCallback(async (formData: IntentFormData) => {
    if (!address || !chainId) {
      addToast({ type: 'error', message: 'Please connect your wallet' });
      return;
    }

    try {
      setTradingState(prev => ({ ...prev, step: 'signing', error: null }));

      // Create intent object
      const intent: Intent = {
        tokenIn: formData.tokenIn,
        tokenOut: formData.tokenOut,
        amountIn: formData.amountIn,
        maxSlippageBps: formData.maxSlippageBps,
        deadline: formData.deadline.toString(),
        chainId: chainId.toString(),
        receiver: address,
        nonce: Date.now().toString() // Simple nonce for demo
      };

      // Create typed data for signing
      const contractAddresses = getContractAddresses(chainId);
      const typedData = createIntentTypedData({
        intent,
        chainId,
        contractAddress: contractAddresses.settlement as any
      });

      // Sign the intent
      const signature = await signTypedDataAsync(typedData);

      // Submit to backend
      const response = await apiClient.createIntent({
        intent,
        signature
      });

      setTradingState(prev => ({
        ...prev,
        step: 'bidding',
        intent,
        intentHash: response.intentHash,
        signature
      }));

      addToast({
        type: 'success',
        message: 'Intent created successfully! Waiting for solver bids...'
      });

    } catch (error) {
      console.error('Intent creation failed:', error);
      setTradingState(prev => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Failed to create intent'
      }));
      addToast({
        type: 'error',
        message: 'Failed to create intent. Please try again.'
      });
    }
  }, [address, chainId, signTypedDataAsync, addToast]);

  // Handle bid selection and execution
  const handleSelectBid = useCallback(async (bid: BidLike) => {
    if (!tradingState.intent || !tradingState.signature) {
      addToast({ type: 'error', message: 'Missing intent data' });
      return;
    }

    try {
      setTradingState(prev => ({ 
        ...prev, 
        step: 'executing', 
        selectedBid: bid, 
        error: null 
      }));

      // In a real implementation, this would call the settlement contract
      // For now, we'll simulate a successful execution
      await new Promise(resolve => setTimeout(resolve, 3000));

      const mockTxHash = '0x' + Math.random().toString(16).slice(2, 66);
      
      setTradingState(prev => ({
        ...prev,
        step: 'completed',
        txHash: mockTxHash
      }));

      addToast({
        type: 'success',
        message: 'Trade executed successfully!'
      });

    } catch (error) {
      console.error('Trade execution failed:', error);
      setTradingState(prev => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Failed to execute trade'
      }));
      addToast({
        type: 'error',
        message: 'Failed to execute trade. Please try again.'
      });
    }
  }, [tradingState.intent, tradingState.signature, addToast]);

  // Reset trading state
  const handleReset = useCallback(() => {
    setTradingState({
      step: isConnected ? 'create' : 'connect',
      intent: null,
      intentHash: null,
      signature: null,
      selectedBid: null,
      error: null,
      txHash: null
    });
  }, [isConnected]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container-responsive py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight mb-4">
              Intent Trading Aggregator
            </h1>
            <p className="text-lg text-muted-foreground">
              Express your trading intent. Let solvers compete for the best execution.
            </p>
          </div>

          {/* Main Content */}
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left Column - Form/Status */}
            <div>
              {tradingState.step === 'connect' && <WalletConnection />}
              
              {tradingState.step === 'create' && (
                <div className="space-y-6">
                  <div className="p-6 bg-card rounded-lg border">
                    <h2 className="text-xl font-semibold mb-4">Create Intent</h2>
                    <IntentForm
                      onSubmit={handleCreateIntent}
                      isSubmitting={tradingState.step === 'signing'}
                    />
                  </div>
                </div>
              )}

              {(tradingState.step === 'executing' || 
                tradingState.step === 'completed' || 
                tradingState.step === 'error') && (
                <TransactionStatus
                  step={tradingState.step}
                  txHash={tradingState.txHash}
                  error={tradingState.error}
                  onReset={handleReset}
                />
              )}
            </div>

            {/* Right Column - Bids/Info */}
            <div>
              {tradingState.step === 'bidding' && tradingState.intentHash && (
                <BidDisplay
                  intentHash={tradingState.intentHash}
                  onSelectBid={handleSelectBid}
                />
              )}

              {(tradingState.step === 'create' || tradingState.step === 'connect') && (
                <div className="space-y-6">
                  <div className="p-6 bg-card rounded-lg border">
                    <h3 className="text-lg font-semibold mb-4">How it works</h3>
                    <div className="space-y-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                          1
                        </div>
                        <div>
                          <div className="font-medium">Express Intent</div>
                          <div className="text-sm text-muted-foreground">
                            Specify what tokens you want to trade
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                          2
                        </div>
                        <div>
                          <div className="font-medium">Solver Competition</div>
                          <div className="text-sm text-muted-foreground">
                            Solvers compete to provide the best execution
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                          3
                        </div>
                        <div>
                          <div className="font-medium">Best Execution</div>
                          <div className="text-sm text-muted-foreground">
                            Get optimal pricing with one-click execution
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-card rounded-lg border">
                    <h3 className="text-lg font-semibold mb-4">Benefits</h3>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm">Single signature approval</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm">Better than market prices</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm">MEV protection built-in</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm">L2 optimized for low fees</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}