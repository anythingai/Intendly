/**
 * @fileoverview Bid database model
 * @description Database operations for bid persistence and ranking
 */

import { PoolClient } from 'pg';
import db from '../connection.js';
import { BidRecord, BidStatus, Bid } from '@/types/bid.js';

export class BidModel {
  static readonly TABLE_NAME = 'bids';

  /**
   * Create a new bid record
   */
  static async create(data: {
    intentHash: string;
    solverId: string;
    quoteOut: string;
    solverFeeBps: number;
    payloadUri?: string;
    solverSignature: string;
  }): Promise<BidRecord> {
    const query = `
      INSERT INTO ${this.TABLE_NAME} (
        id, intent_hash, solver_id, quote_out, solver_fee_bps, 
        payload_uri, solver_signature, status, arrived_at
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;

    const params = [
      data.intentHash,
      data.solverId,
      data.quoteOut,
      data.solverFeeBps,
      data.payloadUri,
      data.solverSignature,
      BidStatus.PENDING,
    ];

    const result = await db.query<any>(query, params);
    if (result.length === 0) {
      throw new Error('Failed to create bid record');
    }

    return this.mapDbRecord(result[0]);
  }

  /**
   * Find bids by intent hash
   */
  static async findByIntentHash(intentHash: string): Promise<BidRecord[]> {
    const query = `
      SELECT * FROM ${this.TABLE_NAME} 
      WHERE intent_hash = $1
      ORDER BY score DESC, arrived_at ASC
    `;

    const result = await db.query<any>(query, [intentHash]);
    return result.map(record => this.mapDbRecord(record));
  }

  /**
   * Find bid by ID
   */
  static async findById(bidId: string): Promise<BidRecord | null> {
    const query = `
      SELECT * FROM ${this.TABLE_NAME} 
      WHERE id = $1
    `;

    const result = await db.query<any>(query, [bidId]);
    if (result.length === 0) {
      return null;
    }

    return this.mapDbRecord(result[0]);
  }

  /**
   * Update bid status
   */
  static async updateStatus(
    bidId: string,
    status: BidStatus,
    client?: PoolClient
  ): Promise<BidRecord | null> {
    const query = `
      UPDATE ${this.TABLE_NAME}
      SET status = $1
      WHERE id = $2
      RETURNING *
    `;

    const params = [status, bidId];
    
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
   * Update bid score and rank
   */
  static async updateScoreAndRank(
    bidId: string,
    score: number,
    rank: number,
    client?: PoolClient
  ): Promise<void> {
    const query = `
      UPDATE ${this.TABLE_NAME}
      SET score = $1, rank = $2
      WHERE id = $3
    `;

    const params = [score, rank, bidId];
    
    if (client) {
      await client.query(query, params);
    } else {
      await db.query(query, params);
    }
  }

  /**
   * Get best bid for an intent
   */
  static async getBestBid(intentHash: string): Promise<BidRecord | null> {
    const query = `
      SELECT * FROM ${this.TABLE_NAME}
      WHERE intent_hash = $1 
      AND status = $2
      ORDER BY score DESC, arrived_at ASC
      LIMIT 1
    `;

    const result = await db.query<any>(query, [intentHash, BidStatus.ACCEPTED]);
    if (result.length === 0) {
      return null;
    }

    return this.mapDbRecord(result[0]);
  }

  /**
   * Get bid rankings for an intent
   */
  static async getRankings(
    intentHash: string,
    limit: number = 10
  ): Promise<BidRecord[]> {
    const query = `
      SELECT * FROM ${this.TABLE_NAME}
      WHERE intent_hash = $1
      AND status IN ($2, $3)
      ORDER BY rank ASC, score DESC
      LIMIT $4
    `;

    const result = await db.query<any>(query, [
      intentHash,
      BidStatus.ACCEPTED,
      BidStatus.WON,
      limit
    ]);

    return result.map(record => this.mapDbRecord(record));
  }

  /**
   * Mark expired bids
   */
  static async markExpired(intentHash: string): Promise<number> {
    const query = `
      UPDATE ${this.TABLE_NAME}
      SET status = $1
      WHERE intent_hash = $2 
      AND status = $3
    `;

    const result = await db.query(query, [
      BidStatus.EXPIRED,
      intentHash,
      BidStatus.PENDING
    ]);

    return result.length;
  }

  /**
   * Get solver performance metrics
   */
  static async getSolverMetrics(solverId: string): Promise<{
    totalBids: number;
    wonBids: number;
    winRate: number;
    averageScore: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_bids,
        COUNT(CASE WHEN status = $2 THEN 1 END) as won_bids,
        AVG(CASE WHEN score IS NOT NULL THEN score END) as avg_score
      FROM ${this.TABLE_NAME}
      WHERE solver_id = $1
    `;

    const result = await db.query<{
      total_bids: string;
      won_bids: string;
      avg_score: string;
    }>(query, [solverId, BidStatus.WON]);

    if (result.length === 0) {
      return {
        totalBids: 0,
        wonBids: 0,
        winRate: 0,
        averageScore: 0
      };
    }

    const row = result[0];
    const totalBids = parseInt(row.total_bids);
    const wonBids = parseInt(row.won_bids);

    return {
      totalBids,
      wonBids,
      winRate: totalBids > 0 ? (wonBids / totalBids) * 100 : 0,
      averageScore: parseFloat(row.avg_score) || 0
    };
  }

  /**
   * Delete old bids (cleanup)
   */
  static async deleteOld(olderThanDays: number = 30): Promise<number> {
    const query = `
      DELETE FROM ${this.TABLE_NAME}
      WHERE arrived_at < NOW() - INTERVAL '${olderThanDays} days'
      AND status IN ($1, $2, $3)
    `;

    const result = await db.query(query, [
      BidStatus.EXPIRED,
      BidStatus.LOST,
      BidStatus.REJECTED
    ]);

    return result.length;
  }

  /**
   * Map database record to BidRecord type
   */
  private static mapDbRecord(dbRecord: any): BidRecord {
    return {
      id: dbRecord.id,
      intentHash: dbRecord.intent_hash,
      solverId: dbRecord.solver_id,
      quoteOut: dbRecord.quote_out,
      solverFeeBps: dbRecord.solver_fee_bps,
      payloadUri: dbRecord.payload_uri,
      arrivedAt: new Date(dbRecord.arrived_at),
      solverSignature: dbRecord.solver_signature,
      rank: dbRecord.rank,
      score: dbRecord.score,
      status: dbRecord.status as BidStatus
    };
  }
}

export default BidModel;