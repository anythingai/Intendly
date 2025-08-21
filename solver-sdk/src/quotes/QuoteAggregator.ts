/**
 * @fileoverview Multi-source quote fetching and comparison
 * @description Aggregates quotes from multiple DEX sources and selects the best one
 */

import type {
  Quote,
  QuoteSource,
  SolverConfig
} from '../types/index.js';

export interface QuoteAggregatorEvents {
  quoteFetched: [{ source: string; quote: Quote }];
  quoteError: [{ source: string; error: string }];
  error: [Error];
}

export class QuoteAggregator {
  private config: SolverConfig;
  private quoteSources: Map<string, QuoteSource> = new Map();
  private eventHandlers: Map<keyof QuoteAggregatorEvents, Function[]> = new Map();

  constructor(config: SolverConfig) {
    this.config = config;
  }

  /**
   * Add event listener
   */
  on<K extends keyof QuoteAggregatorEvents>(
    event: K,
    handler: (...args: QuoteAggregatorEvents[K]) => void
  ): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Emit event
   */
  private emit<K extends keyof QuoteAggregatorEvents>(
    event: K,
    ...args: QuoteAggregatorEvents[K]
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }

  /**
   * Add a quote source
   */
  addSource(source: QuoteSource): void {
    this.quoteSources.set(source.name, source);
  }

  /**
   * Remove a quote source
   */
  removeSource(sourceName: string): void {
    this.quoteSources.delete(sourceName);
  }

  /**
   * Get quotes from all available sources
   */
  async getQuotes(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<Quote[]> {
    if (this.quoteSources.size === 0) {
      return [];
    }

    const quotePromises = Array.from(this.quoteSources.values()).map(async (source) => {
      try {
        const quote = await source.getQuote(tokenIn, tokenOut, amountIn);
        this.emit('quoteFetched', { source: source.name, quote });
        return quote;
      } catch (error) {
        const errorMessage = (error as Error).message;
        this.emit('quoteError', { source: source.name, error: errorMessage });
        return null;
      }
    });

    const results = await Promise.allSettled(quotePromises);
    const validQuotes: Quote[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        validQuotes.push(result.value);
      }
    }

    return validQuotes;
  }

  /**
   * Get the best quote from multiple sources
   */
  async getBestQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<Quote | null> {
    const quotes = await this.getQuotes(tokenIn, tokenOut, amountIn);
    
    if (quotes.length === 0) {
      return null;
    }

    // Select quote with highest output amount
    return quotes.reduce((best, current) => {
      return current.amountOut > best.amountOut ? current : best;
    });
  }

  /**
   * Get quote from specific source
   */
  async getQuoteFromSource(
    sourceName: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<Quote | null> {
    const source = this.quoteSources.get(sourceName);
    if (!source) {
      throw new Error(`Quote source '${sourceName}' not found`);
    }

    try {
      const quote = await source.getQuote(tokenIn, tokenOut, amountIn);
      this.emit('quoteFetched', { source: sourceName, quote });
      return quote;
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.emit('quoteError', { source: sourceName, error: errorMessage });
      return null;
    }
  }

  /**
   * Get all available source names
   */
  getSourceNames(): string[] {
    return Array.from(this.quoteSources.keys());
  }

  /**
   * Check if a source is available
   */
  hasSource(sourceName: string): boolean {
    return this.quoteSources.has(sourceName);
  }

  /**
   * Get source count
   */
  getSourceCount(): number {
    return this.quoteSources.size;
  }

  /**
   * Clear all sources
   */
  clearSources(): void {
    this.quoteSources.clear();
  }

  /**
   * Get quotes with timeout
   */
  async getQuotesWithTimeout(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    timeoutMs = 5000
  ): Promise<Quote[]> {
    const quotesPromise = this.getQuotes(tokenIn, tokenOut, amountIn);
    const timeoutPromise = new Promise<Quote[]>((_, reject) => {
      setTimeout(() => reject(new Error('Quote aggregation timeout')), timeoutMs);
    });

    try {
      return await Promise.race([quotesPromise, timeoutPromise]);
    } catch (error) {
      this.emit('error', error as Error);
      return [];
    }
  }

  /**
   * Compare quotes and return sorted by output amount (descending)
   */
  compareQuotes(quotes: Quote[]): Quote[] {
    return [...quotes].sort((a, b) => {
      if (a.amountOut > b.amountOut) return -1;
      if (a.amountOut < b.amountOut) return 1;
      return 0;
    });
  }

  /**
   * Filter quotes by minimum output amount
   */
  filterQuotesByMinOutput(quotes: Quote[], minOutput: bigint): Quote[] {
    return quotes.filter(quote => quote.amountOut >= minOutput);
  }

  /**
   * Get quote statistics
   */
  getQuoteStats(quotes: Quote[]): {
    count: number;
    bestOutput: bigint;
    worstOutput: bigint;
    averageOutput: bigint;
    sources: string[];
  } {
    if (quotes.length === 0) {
      return {
        count: 0,
        bestOutput: BigInt(0),
        worstOutput: BigInt(0),
        averageOutput: BigInt(0),
        sources: []
      };
    }

    const outputs = quotes.map(q => q.amountOut);
    const sum = outputs.reduce((acc, curr) => acc + curr, BigInt(0));

    return {
      count: quotes.length,
      bestOutput: outputs.reduce((max, curr) => curr > max ? curr : max),
      worstOutput: outputs.reduce((min, curr) => curr < min ? curr : min),
      averageOutput: sum / BigInt(quotes.length),
      sources: quotes.map(q => q.source)
    };
  }
}