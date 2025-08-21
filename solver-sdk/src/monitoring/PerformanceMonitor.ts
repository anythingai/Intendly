/**
 * @fileoverview Performance tracking and metrics collection
 * @description Monitors solver performance including latency, success rates, and volumes
 */

import type {
  SolverMetrics,
  BidMetrics,
  PerformanceConfig
} from '../types/index.js';

export class PerformanceMonitor {
  private config: PerformanceConfig;
  private isRunning = false;
  private bidHistory: BidMetrics[] = [];
  private totalBids = 0;
  private wonBids = 0;
  private totalVolume = BigInt(0);
  private startTime = 0;

  constructor(config: PerformanceConfig) {
    this.config = {
      enablePerformanceMonitoring: true,
      ...config
    };
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();
    
    // Clear existing metrics
    this.bidHistory = [];
    this.totalBids = 0;
    this.wonBids = 0;
    this.totalVolume = BigInt(0);

    console.log('📊 Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    console.log('📊 Performance monitoring stopped');
  }

  /**
   * Record a bid attempt
   */
  recordBid(startTime: number, success: boolean, volume?: bigint): void {
    if (!this.isRunning || !this.config.enablePerformanceMonitoring) {
      return;
    }

    const responseTime = Date.now() - startTime;
    const bidMetric: BidMetrics = {
      timestamp: Date.now(),
      responseTime,
      success
    };

    this.bidHistory.push(bidMetric);
    this.totalBids++;

    if (success) {
      this.wonBids++;
    }

    if (volume) {
      this.totalVolume += volume;
    }

    // Keep only last 1000 bid records to prevent memory issues
    if (this.bidHistory.length > 1000) {
      this.bidHistory = this.bidHistory.slice(-1000);
    }
  }

  /**
   * Record a won bid
   */
  recordWonBid(volume: bigint): void {
    if (!this.isRunning) {
      return;
    }

    this.wonBids++;
    this.totalVolume += volume;
  }

  /**
   * Get current solver metrics
   */
  getMetrics(): SolverMetrics {
    const winRate = this.totalBids > 0 ? (this.wonBids / this.totalBids) * 100 : 0;
    const averageResponseTime = this.calculateAverageResponseTime();

    return {
      totalBids: this.totalBids,
      wonBids: this.wonBids,
      winRate: Math.round(winRate * 100) / 100, // Round to 2 decimal places
      averageResponseTime: Math.round(averageResponseTime),
      totalVolume: this.totalVolume.toString()
    };
  }

  /**
   * Get response time statistics
   */
  getResponseTimeStats(): {
    min: number;
    max: number;
    average: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    if (this.bidHistory.length === 0) {
      return {
        min: 0,
        max: 0,
        average: 0,
        p50: 0,
        p95: 0,
        p99: 0
      };
    }

    const responseTimes = this.bidHistory.map(bid => bid.responseTime).sort((a, b) => a - b);
    const len = responseTimes.length;

    return {
      min: responseTimes[0],
      max: responseTimes[len - 1],
      average: Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / len),
      p50: responseTimes[Math.floor(len * 0.5)],
      p95: responseTimes[Math.floor(len * 0.95)],
      p99: responseTimes[Math.floor(len * 0.99)]
    };
  }

  /**
   * Get recent performance (last N bids)
   */
  getRecentPerformance(count = 100): {
    winRate: number;
    averageResponseTime: number;
    totalBids: number;
  } {
    const recentBids = this.bidHistory.slice(-count);
    
    if (recentBids.length === 0) {
      return {
        winRate: 0,
        averageResponseTime: 0,
        totalBids: 0
      };
    }

    const wonBids = recentBids.filter(bid => bid.success).length;
    const winRate = (wonBids / recentBids.length) * 100;
    const averageResponseTime = recentBids.reduce((sum, bid) => sum + bid.responseTime, 0) / recentBids.length;

    return {
      winRate: Math.round(winRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      totalBids: recentBids.length
    };
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    if (this.bidHistory.length === 0) {
      return 0;
    }

    const totalResponseTime = this.bidHistory.reduce((sum, bid) => sum + bid.responseTime, 0);
    return totalResponseTime / this.bidHistory.length;
  }

  /**
   * Get uptime in milliseconds
   */
  getUptime(): number {
    return this.isRunning ? Date.now() - this.startTime : 0;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.bidHistory = [];
    this.totalBids = 0;
    this.wonBids = 0;
    this.totalVolume = BigInt(0);
    this.startTime = Date.now();
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    const metrics = {
      ...this.getMetrics(),
      responseTimeStats: this.getResponseTimeStats(),
      recentPerformance: this.getRecentPerformance(),
      uptime: this.getUptime(),
      timestamp: Date.now()
    };

    return JSON.stringify(metrics, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    , 2);
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.isRunning;
  }
}