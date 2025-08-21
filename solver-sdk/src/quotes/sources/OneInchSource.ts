/**
 * @fileoverview 1inch API integration for quote fetching
 * @description Professional-grade DEX aggregation via 1inch API
 */

import type { Quote, QuoteSource } from '../../types/index.js';

export interface OneInchConfig {
  apiKey?: string;
  baseUrl?: string;
  chainId: number;
  rateLimit?: {
    requestsPerSecond: number;
    burstSize: number;
  };
  timeout?: number;
}

export interface OneInchQuoteParams {
  src: string;
  dst: string;
  amount: string;
  fee?: string;
  gasPrice?: string;
  complexityLevel?: string;
  connectorTokens?: string;
  gasLimit?: string;
  mainRouteParts?: string;
  parts?: string;
}

export interface OneInchQuoteResponse {
  dstAmount: string;
  srcAmount: string;
  protocols: Array<Array<Array<{
    name: string;
    part: number;
    fromTokenAddress: string;
    toTokenAddress: string;
  }>>>;
  gas: string;
}

export class OneInchSource implements QuoteSource {
  public readonly name = '1inch';
  private config: Required<OneInchConfig>;
  private rateLimiter: {
    tokens: number;
    lastRefill: number;
  };

  constructor(config: OneInchConfig) {
    this.config = {
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl || 'https://api.1inch.dev',
      chainId: config.chainId,
      rateLimit: config.rateLimit || { requestsPerSecond: 10, burstSize: 20 },
      timeout: config.timeout || 5000
    };

    // Initialize rate limiter
    this.rateLimiter = {
      tokens: this.config.rateLimit.burstSize,
      lastRefill: Date.now()
    };
  }

  /**
   * Get quote from 1inch API
   */
  async getQuote(tokenIn: string, tokenOut: string, amountIn: bigint): Promise<Quote> {
    await this.checkRateLimit();

    try {
      const params: OneInchQuoteParams = {
        src: tokenIn,
        dst: tokenOut,
        amount: amountIn.toString(),
        fee: '0', // No additional fees
        gasPrice: 'fast', // Use fast gas price
        complexityLevel: '2', // Medium complexity
        parts: '50', // Number of parts for splitting
        mainRouteParts: '50'
      };

      const url = this.buildQuoteUrl(params);
      const response = await this.makeRequest(url);

      return this.parseQuoteResponse(response);
    } catch (error) {
      throw new Error(`1inch API error: ${(error as Error).message}`);
    }
  }

  /**
   * Build quote URL with parameters
   */
  private buildQuoteUrl(params: OneInchQuoteParams): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    return `${this.config.baseUrl}/swap/v5.2/${this.config.chainId}/quote?${searchParams.toString()}`;
  }

  /**
   * Make HTTP request to 1inch API
   */
  private async makeRequest(url: string): Promise<OneInchQuoteResponse> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
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
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as OneInchQuoteResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  /**
   * Parse 1inch API response into standard Quote format
   */
  private parseQuoteResponse(response: OneInchQuoteResponse): Quote {
    // Extract route information from protocols
    const route = this.extractRoute(response.protocols);
    
    return {
      amountOut: BigInt(response.dstAmount),
      route,
      gasEstimate: BigInt(response.gas),
      source: this.name
    };
  }

  /**
   * Extract route from 1inch protocols structure
   */
  private extractRoute(protocols: OneInchQuoteResponse['protocols']): string[] {
    const tokens = new Set<string>();
    
    // Flatten the nested protocols structure
    protocols.forEach(level => {
      level.forEach(protocolGroup => {
        protocolGroup.forEach(protocol => {
          tokens.add(protocol.fromTokenAddress);
          tokens.add(protocol.toTokenAddress);
        });
      });
    });

    return Array.from(tokens);
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
    return [1, 56, 137, 43114, 42161, 10, 196]; // ETH, BSC, Polygon, Avalanche, Arbitrum, Optimism, X Layer
  }

  /**
   * Check if chain is supported
   */
  isChainSupported(chainId: number): boolean {
    return OneInchSource.getSupportedChains().includes(chainId);
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
}