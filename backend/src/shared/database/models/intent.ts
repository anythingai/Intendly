/**
 * @fileoverview Intent database model
 * @description Database operations for intent persistence
 */

import { PoolClient } from 'pg';
import db from '../connection.js';
import { IntentRecord, IntentStatus, Intent } from '@/types/intent.js';

export class IntentModel {
  static readonly TABLE_NAME = 'intents';

  /**
   * Create a new intent record
   */
  static async create(data: {
    intentHash: string;
    payload: Intent;
    signature: string;
    signer: string;
    expiresAt: Date;
  }): Promise<IntentRecord> {
    const query = `
      INSERT INTO ${this.TABLE_NAME} (
        intent_hash, payload, signature, signer, status, expires_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `;

    const params = [
      data.intentHash,
      JSON.stringify(data.payload),
      data.signature,
      data.signer,
      IntentStatus.NEW,
      data.expiresAt,
    ];

    const result = await db.query<IntentRecord>(query, params);
    if (result.length === 0) {
      throw new Error('Failed to create intent record');
    }

    return this.mapDbRecord(result[0]);
  }

  /**
   * Find intent by hash
   */
  static async findByHash(intentHash: string): Promise<IntentRecord | null> {
    const query = `
      SELECT * FROM ${this.TABLE_NAME} 
      WHERE intent_hash = $1
    `;

    const result = await db.query<any>(query, [intentHash]);
    if (result.length === 0) {
      return null;
    }

    return this.mapDbRecord(result[0]);
  }

  /**
   * Update intent status
   */
  static async updateStatus(
    intentHash: string, 
    status: IntentStatus,
    client?: PoolClient
  ): Promise<IntentRecord | null> {
    const query = `
      UPDATE ${this.TABLE_NAME} 
      SET status = $1, updated_at = NOW()
      WHERE intent_hash = $2
      RETURNING *
    `;

    const params = [status, intentHash];
    
    let result: any[];
    if (client) {
      const res = await client.query(query, params);
      result = res.rows;
    } else {
      result = await db.query<any>(query, params);
    }

    if (result.length === 0) {
      return null;
    }

    return this.mapDbRecord(result[0]);
  }

  /**
   * Update best bid for intent
   */
  static async updateBestBid(
    intentHash: string,
    bestBid: string,
    totalBids: number,
    client?: PoolClient
  ): Promise<void> {
    const query = `
      UPDATE ${this.TABLE_NAME} 
      SET best_bid = $1, total_bids = $2, updated_at = NOW()
      WHERE intent_hash = $3
    `;

    const params = [bestBid, totalBids, intentHash];
    
    if (client) {
      await client.query(query, params);
    } else {
      await db.query(query, params);
    }
  }

  /**
   * Find intents by signer
   */
  static async findBySigner(
    signer: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<IntentRecord[]> {
    const query = `
      SELECT * FROM ${this.TABLE_NAME}
      WHERE signer = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query<any>(query, [signer, limit, offset]);
    return result.map(record => this.mapDbRecord(record));
  }

  /**
   * Find expired intents
   */
  static async findExpired(limit: number = 100): Promise<IntentRecord[]> {
    const query = `
      SELECT * FROM ${this.TABLE_NAME}
      WHERE expires_at < NOW() 
      AND status NOT IN ($1, $2, $3)
      ORDER BY expires_at ASC
      LIMIT $4
    `;

    const result = await db.query<any>(query, [
      IntentStatus.FILLED,
      IntentStatus.EXPIRED,
      IntentStatus.CANCELLED,
      limit
    ]);

    return result.map(record => this.mapDbRecord(record));
  }

  /**
   * Get intent statistics
   */
  static async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    last24h: number;
  }> {
    const queries = [
      `SELECT COUNT(*) as total FROM ${this.TABLE_NAME}`,
      `SELECT status, COUNT(*) as count FROM ${this.TABLE_NAME} GROUP BY status`,
      `SELECT COUNT(*) as count FROM ${this.TABLE_NAME} WHERE created_at > NOW() - INTERVAL '24 hours'`
    ];

    const [totalResult, statusResult, recentResult] = await Promise.all([
      db.query<{total: string}>(queries[0]),
      db.query<{status: string, count: string}>(queries[1]),
      db.query<{count: string}>(queries[2])
    ]);

    const byStatus: Record<string, number> = {};
    statusResult.forEach(row => {
      byStatus[row.status] = parseInt(row.count);
    });

    return {
      total: parseInt(totalResult[0].total),
      byStatus,
      last24h: parseInt(recentResult[0].count)
    };
  }

  /**
   * Delete expired intents (cleanup)
   */
  static async deleteExpired(olderThanDays: number = 7): Promise<number> {
    const query = `
      DELETE FROM ${this.TABLE_NAME}
      WHERE expires_at < NOW() - INTERVAL '${olderThanDays} days'
      AND status IN ($1, $2, $3)
    `;

    const result = await db.query(query, [
      IntentStatus.EXPIRED,
      IntentStatus.FAILED,
      IntentStatus.CANCELLED
    ]);

    return result.length;
  }

  /**
   * Map database record to IntentRecord type
   */
  private static mapDbRecord(dbRecord: any): IntentRecord {
    return {
      intentHash: dbRecord.intent_hash,
      payload: typeof dbRecord.payload === 'string' 
        ? JSON.parse(dbRecord.payload) 
        : dbRecord.payload,
      signature: dbRecord.signature,
      signer: dbRecord.signer,
      status: dbRecord.status as IntentStatus,
      createdAt: new Date(dbRecord.created_at),
      updatedAt: new Date(dbRecord.updated_at),
      expiresAt: new Date(dbRecord.expires_at),
      totalBids: dbRecord.total_bids || 0,
      bestBid: dbRecord.best_bid
    };
  }
}

export default IntentModel;