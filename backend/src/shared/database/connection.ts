/**
 * @fileoverview Database connection management
 * @description PostgreSQL connection with connection pooling
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import config from '../config/index.js';

class DatabaseConnection {
  private pool: Pool;
  private isConnected = false;

  constructor() {
    const poolConfig: PoolConfig = {
      connectionString: config.database.url,
      min: config.database.pool.min,
      max: config.database.pool.max,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    this.pool = new Pool(poolConfig);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.pool.on('connect', (client: PoolClient) => {
      this.isConnected = true;
      if (config.isDevelopment) {
        console.log('Database client connected');
      }
    });

    this.pool.on('error', (err: Error) => {
      console.error('Database connection error:', err);
      this.isConnected = false;
    });

    this.pool.on('remove', () => {
      if (config.isDevelopment) {
        console.log('Database client removed');
      }
    });
  }

  async connect(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.isConnected = true;
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      if (config.isDevelopment && duration > 100) {
        console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
      }

      return result.rows;
    } catch (error) {
      console.error('Database query error:', error);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error);
      throw error;
    }
  }

  getPool(): Pool {
    return this.pool;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async healthCheck(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now();
      await this.query('SELECT 1');
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency
      };
    } catch (error) {
      return {
        status: 'unhealthy'
      };
    }
  }
}

// Singleton instance
export const db = new DatabaseConnection();

export default db;