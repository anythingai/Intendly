/**
 * @fileoverview Redis client and caching utilities
 * @description Handles Redis operations for caching and pub/sub messaging
 */

import { createClient, RedisClientType } from 'redis';
import config from '../config/index.js';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
}

export interface PubSubMessage {
  channel: string;
  data: any;
  timestamp: number;
}

class RedisService {
  private client: RedisClientType;
  private subscriber: RedisClientType;
  private publisher: RedisClientType;
  private isConnected = false;

  constructor() {
    // Main client for general operations
    this.client = createClient({
      url: config.redis.url,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
      },
    });

    // Dedicated subscriber client
    this.subscriber = createClient({
      url: config.redis.url,
    });

    // Dedicated publisher client
    this.publisher = createClient({
      url: config.redis.url,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Main client events
    this.client.on('connect', () => {
      console.log('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
      this.isConnected = false;
    });

    this.client.on('disconnect', () => {
      console.log('Redis client disconnected');
      this.isConnected = false;
    });

    // Subscriber events
    this.subscriber.on('error', (err) => {
      console.error('Redis subscriber error:', err);
    });

    // Publisher events
    this.publisher.on('error', (err) => {
      console.error('Redis publisher error:', err);
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect(),
      ]);
      console.log('✅ Redis connected successfully');
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.client.disconnect(),
        this.subscriber.disconnect(),
        this.publisher.disconnect(),
      ]);
      console.log('Redis disconnected');
    } catch (error) {
      console.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const value = await this.client.get(prefixedKey);
      
      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const serializedValue = JSON.stringify(value);

      let result;
      if (options.ttl) {
        result = await this.client.setEx(prefixedKey, options.ttl, serializedValue);
      } else {
        result = await this.client.set(prefixedKey, serializedValue);
      }

      // Store cache tags if provided
      if (options.tags && options.tags.length > 0) {
        await this.addCacheTags(key, options.tags);
      }

      return result === 'OK';
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const result = await this.client.del(prefixedKey);
      return result > 0;
    } catch (error) {
      console.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const result = await this.client.exists(prefixedKey);
      return result > 0;
    } catch (error) {
      console.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiration for key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const result = await this.client.expire(prefixedKey, seconds);
      return result;
    } catch (error) {
      console.error(`Redis EXPIRE error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment numeric value
   */
  async incr(key: string): Promise<number | null> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      return await this.client.incr(prefixedKey);
    } catch (error) {
      console.error(`Redis INCR error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Add item to set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      return await this.client.sAdd(prefixedKey, members);
    } catch (error) {
      console.error(`Redis SADD error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get all members of set
   */
  async smembers(key: string): Promise<string[]> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      return await this.client.sMembers(prefixedKey);
    } catch (error) {
      console.error(`Redis SMEMBERS error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Publish message to channel
   */
  async publish(channel: string, data: any): Promise<boolean> {
    try {
      const message: PubSubMessage = {
        channel,
        data,
        timestamp: Date.now(),
      };

      const result = await this.publisher.publish(channel, JSON.stringify(message));
      return result > 0;
    } catch (error) {
      console.error(`Redis PUBLISH error for channel ${channel}:`, error);
      return false;
    }
  }

  /**
   * Subscribe to channel
   */
  async subscribe(channel: string, callback: (message: PubSubMessage) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(channel, (message) => {
        try {
          const parsed = JSON.parse(message) as PubSubMessage;
          callback(parsed);
        } catch (error) {
          console.error('Error parsing pub/sub message:', error);
        }
      });
    } catch (error) {
      console.error(`Redis SUBSCRIBE error for channel ${channel}:`, error);
    }
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(channel: string): Promise<void> {
    try {
      await this.subscriber.unsubscribe(channel);
    } catch (error) {
      console.error(`Redis UNSUBSCRIBE error for channel ${channel}:`, error);
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let deletedCount = 0;

    for (const tag of tags) {
      try {
        const tagKey = `tags:${tag}`;
        const keys = await this.smembers(tagKey);
        
        if (keys.length > 0) {
          // Delete all keys with this tag
          const prefixedKeys = keys.map(key => this.getPrefixedKey(key));
          const deleted = await this.client.del(prefixedKeys);
          deletedCount += deleted;
          
          // Remove the tag set
          await this.del(tagKey);
        }
      } catch (error) {
        console.error(`Error invalidating tag ${tag}:`, error);
      }
    }

    return deletedCount;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    keyCount: number;
    memory: string;
  }> {
    try {
      const info = await this.client.info('memory');
      const keyCount = await this.client.dbSize();
      
      // Parse memory usage from info string
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memory = memoryMatch ? memoryMatch[1].trim() : 'Unknown';

      return {
        connected: this.isConnected,
        keyCount,
        memory,
      };
    } catch (error) {
      return {
        connected: false,
        keyCount: 0,
        memory: 'Unknown',
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
      };
    }
  }

  /**
   * Get prefixed key
   */
  private getPrefixedKey(key: string): string {
    return `${config.redis.keyPrefix}${key}`;
  }

  /**
   * Add cache tags for a key
   */
  private async addCacheTags(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `tags:${tag}`;
      await this.sadd(tagKey, key);
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const redis = new RedisService();

export default redis;