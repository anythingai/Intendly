/**
 * @fileoverview ParaSwap API integration for quote fetching
 * @description Alternative DEX aggregator for comparison with 1inch
 */

import type { Quote, QuoteSource } from '../../types/index.js';

export interface ParaSwapConfig {
  apiKey?: string;
  baseUrl?: string;
  chainId: number;
  partner?: string;
  rateLimit?: {
    requestsPerSecond: number;
    burstSize: number;
  };
  timeout?: number;
}

export interface ParaSwapPriceParams {
  srcToken: string;
  destToken: string;
  amount: string;
  srcDecimals?: number;
  destDecimals?: number;
  side: 'SELL' | 'BUY';
  network: number;
  otherExchangePrices?: boolean;
  excludeDEXS?: string;
  includeDEXS?: string;
  adapterVersion?: string;
  maxImpact?: number;
  maxUSDImpact?: number;
  partner?: string;
}

export interface ParaSwapPriceResponse {
  priceRoute: {
    destAmount: string;
    srcAmount: string;
    destUSD?: string;
    srcUSD?: string;
    side: string;
    tokenTransferProxy: string;
    contractAddress: string;
    blockNumber: number;
    network: number;
    partner: string;
    maxImpactReached: boolean;
    hmac: string;
    bestRoute: Array<{
      exchange: string;
      srcAmount: string;
      destAmount: string;
      percent: number;
      data: {
        router: string;
        path: string[];
        factory: string;
        initCode: string;
        feeFactor: number;
        pools: Array<{
          address: string;
          fee: number;
          direction: boolean;
        }>;
        gasUSD: string;
      };
    }>;
    others?: Array<{
      exchange: string;
      rate: string;
      unit: string;
      data?: any;
    }>;
    gasCostUSD: string;
    gasCost: string;
  };
}

export class ParaSwapSource implements QuoteSource {
  public readonly name = 'paraswap';
  private config: Required<ParaSwapConfig>;
  private rateLimiter: {
    tokens: number;
    lastRefill: number;
  };

  constructor(config: ParaSwapConfig) {
    this.config = {
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl || 'https://apiv5.paraswap.io',
      chainId: config.chainId,
      partner: config.partner || 'intendly-solver',
      rateLimit: config.rateLimit || { requestsPerSecond: 5, burstSize: 10 },
      timeout: config.timeout || 6000
    };

    // Initialize rate limiter
    this.rateLimiter = {
      tokens: this.config.rateLimit.burstSize,
      lastRefill: Date.now()
    };
  }

  /**
   * Get quote from ParaSwap API
   */
  async getQuote(tokenIn: string, tokenOut: string, amountIn: bigint): Promise<Quote> {
    await this.checkRateLimit();

    try {
      const params: ParaSwapPriceParams = {
        srcToken: tokenIn,
        destToken: tokenOut,
        amount: amountIn.toString(),
        side: 'SELL',
        network: this.config.chainId,
        partner: this.config.partner,
        otherExchangePrices: false,
        maxImpact: 15, // Max 15% price impact
        adapterVersion: '5.2'
      };

      const url = this.buildPriceUrl(params);
      const response = await this.makeRequest(url);

      return this.parsePriceResponse(response);
    } catch (error) {
      throw new Error(`ParaSwap API error: ${(error as Error).message}`);
    }
  }

  /**
   * Build price URL with parameters
   */
  private buildPriceUrl(params: ParaSwapPriceParams): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    return `${this.config.baseUrl}/prices/?${searchParams.toString()}`;
  }

  /**
   * Make HTTP request to ParaSwap API
   */
  private async makeRequest(url: string): Promise<ParaSwapPriceResponse> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Partner': this.config.partner
    };

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        }
        
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.priceRoute) {
        throw new Error('No price route found');
      }

      return data as ParaSwapPriceResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  /**
   * Parse ParaSwap API response into standard Quote format
   */
  private parsePriceResponse(response: ParaSwapPriceResponse): Quote {
    const priceRoute = response.priceRoute;
    
    // Extract route information from best route
    const route = this.extractRoute(priceRoute.bestRoute);
    
    // Estimate gas from route complexity and ParaSwap's gas cost
    const gasEstimate = this.estimateGas(priceRoute);

    return {
      amountOut: BigInt(priceRoute.destAmount),
      route,
      gasEstimate,
      source: this.name
    };
  }

  /**
   * Extract route from ParaSwap best route
   */
  private extractRoute(bestRoute: ParaSwapPriceResponse['priceRoute']['bestRoute']): string[] {
    const tokens = new Set<string>();
    
    bestRoute.forEach(step => {
      if (step.data && step.data.path) {
        step.data.path.forEach(token => tokens.add(token));
      }
    });

    return Array.from(tokens);
  }

  /**
   * Estimate gas cost from ParaSwap route
   */
  private estimateGas(priceRoute: ParaSwapPriceResponse['priceRoute']): bigint {
    // Use ParaSwap's gas cost if available
    if (priceRoute.gasCost) {
      return BigInt(priceRoute.gasCost);
    }

    // Fallback: estimate based on route complexity
    const routeComplexity = priceRoute.bestRoute.length;
    const baseGas = 150000; // Base swap gas
    const complexityGas = routeComplexity * 50000; // Additional gas per hop

    return BigInt(baseGas + complexityGas);
  }

  /**
   * Check rate limiting before making request
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const timePassed = now - this.rateLimiter.lastRefill;
    
    // Refill tokens based on time passed
    const tokensToAdd = Math.floor(timePassed / 1000 * this.config.rateLimit.requestsPerSecond);
    this.rateLimiter.tokens = Math.min(
      this.config.rateLimit.burstSize,
      this.rateLimiter.tokens + tokensToAdd
    );
    this.rateLimiter.lastRefill = now;

    // Check if we have tokens available
    if (this.rateLimiter.tokens < 1) {
      const waitTime = 1000 / this.config.rateLimit.requestsPerSecond;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.rateLimiter.tokens = 1;
    }

    // Consume a token
    this.rateLimiter.tokens--;
  }

  /**
   * Get supported chains
   */
  static getSupportedChains(): number[] {
    return [1, 56, 137, 43114, 42161, 10, 250, 8453]; // ETH, BSC, Polygon, Avalanche, Arbitrum, Optimism, Fantom, Base
  }

  /**
   * Check if chain is supported
   */
  isChainSupported(chainId: number): boolean {
    return ParaSwapSource.getSupportedChains().includes(chainId);
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): {
    tokensRemaining: number;
    tokensPerSecond: number;
    burstSize: number;
  } {
    return {
      tokensRemaining: this.rateLimiter.tokens,
      tokensPerSecond: this.config.rateLimit.requestsPerSecond,
      burstSize: this.config.rateLimit.burstSize
    };
  }

  /**
   * Get price impact information if available
   */
  getPriceImpact(response: ParaSwapPriceResponse): {
    maxImpactReached: boolean;
    estimatedImpact?: number;
  } {
    return {
      maxImpactReached: response.priceRoute.maxImpactReached,
      // ParaSwap doesn't always provide explicit impact percentage
      estimatedImpact: undefined
    };
  }

  /**
   * Validate token addresses for the configured chain
   */
  private validateTokenAddresses(tokenIn: string, tokenOut: string): void {
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    
    if (!addressRegex.test(tokenIn)) {
      throw new Error(`Invalid tokenIn address: ${tokenIn}`);
    }
    
    if (!addressRegex.test(tokenOut)) {
      throw new Error(`Invalid tokenOut address: ${tokenOut}`);
    }
    
    if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
      throw new Error('tokenIn and tokenOut cannot be the same');
    }
  }

  /**
   * Get transaction data for the quote (requires separate API call)
   */
  async getTransactionData(
    priceRoute: ParaSwapPriceResponse['priceRoute'],
    userAddress: string,
    slippage: number = 100 // in basis points
  ): Promise<{
    to: string;
    data: string;
    value: string;
    gasPrice: string;
    gas: string;
  }> {
    const transactionUrl = `${this.config.baseUrl}/transactions/${this.config.chainId}`;
    
    const payload = {
      priceRoute,
      srcToken: priceRoute.bestRoute[0]?.data?.path?.[0],
      destToken: priceRoute.bestRoute[priceRoute.bestRoute.length - 1]?.data?.path?.slice(-1)[0],
      srcAmount: priceRoute.srcAmount,
      destAmount: priceRoute.destAmount,
      userAddress,
      partner: this.config.partner,
      slippage
    };

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Partner': this.config.partner
    };

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    const response = await fetch(transactionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Failed to get transaction data: ${response.statusText}`);
    }

    return await response.json();
  }
}