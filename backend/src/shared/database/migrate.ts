/**
 * @fileoverview Database migration runner
 * @description Handles database schema migrations and versioning
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './connection.js';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Migration {
  version: string;
  filename: string;
  sql: string;
}

class MigrationRunner {
  private migrationsDir: string;

  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  /**
   * Initialize migration tracking table
   */
  private async initMigrationTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        version VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL
      );
    `;

    await db.query(query);
    console.log('✅ Migration tracking table initialized');
  }

  /**
   * Get all available migration files
   */
  private async getMigrationFiles(): Promise<Migration[]> {
    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const migrations: Migration[] = [];

    for (const filename of files) {
      const filePath = path.join(this.migrationsDir, filename);
      const sql = fs.readFileSync(filePath, 'utf8');
      const version = filename.replace('.sql', '');

      migrations.push({
        version,
        filename,
        sql
      });
    }

    return migrations;
  }

  /**
   * Get applied migrations
   */
  private async getAppliedMigrations(): Promise<Set<string>> {
    try {
      const result = await db.query<{ version: string }>('SELECT version FROM migrations');
      return new Set(result.map(row => row.version));
    } catch (error) {
      // Table doesn't exist yet
      return new Set();
    }
  }

  /**
   * Calculate SQL checksum
   */
  private calculateChecksum(sql: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(sql).digest('hex');
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(migration: Migration): Promise<void> {
    const checksum = this.calculateChecksum(migration.sql);

    console.log(`🔄 Applying migration: ${migration.filename}`);

    try {
      await db.transaction(async (client) => {
        // Execute migration SQL
        await client.query(migration.sql);

        // Record migration
        await client.query(
          'INSERT INTO migrations (version, filename, applied_at, checksum) VALUES ($1, $2, NOW(), $3)',
          [migration.version, migration.filename, checksum]
        );
      });

      console.log(`✅ Applied migration: ${migration.filename}`);
    } catch (error) {
      console.error(`❌ Failed to apply migration ${migration.filename}:`, error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    try {
      console.log('🚀 Starting database migration...');

      // Connect to database
      await db.connect();

      // Initialize migration tracking
      await this.initMigrationTable();

      // Get migrations
      const availableMigrations = await this.getMigrationFiles();
      const appliedMigrations = await this.getAppliedMigrations();

      console.log(`📋 Found ${availableMigrations.length} migration files`);
      console.log(`✅ ${appliedMigrations.size} migrations already applied`);

      // Find pending migrations
      const pendingMigrations = availableMigrations.filter(
        migration => !appliedMigrations.has(migration.version)
      );

      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations');
        return;
      }

      console.log(`🔄 Applying ${pendingMigrations.length} pending migrations...`);

      // Apply pending migrations
      for (const migration of pendingMigrations) {
        await this.applyMigration(migration);
      }

      console.log('🎉 All migrations completed successfully!');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Show migration status
   */
  async status(): Promise<void> {
    try {
      await db.connect();
      await this.initMigrationTable();

      const availableMigrations = await this.getMigrationFiles();
      const appliedMigrations = await this.getAppliedMigrations();

      console.log('\n📊 Migration Status:');
      console.log('==================');

      for (const migration of availableMigrations) {
        const status = appliedMigrations.has(migration.version) ? '✅' : '⏳';
        console.log(`${status} ${migration.filename}`);
      }

      const pendingCount = availableMigrations.length - appliedMigrations.size;
      console.log(`\n📋 Total: ${availableMigrations.length} migrations`);
      console.log(`✅ Applied: ${appliedMigrations.size}`);
      console.log(`⏳ Pending: ${pendingCount}`);

    } catch (error) {
      console.error('❌ Failed to get migration status:', error);
      throw error;
    }
  }

  /**
   * Reset database (drop all tables) - USE WITH CAUTION
   */
  async reset(): Promise<void> {
    if (config.isProduction) {
      throw new Error('Database reset is not allowed in production');
    }

    console.log('⚠️  WARNING: This will drop all tables!');
    
    try {
      await db.connect();

      const dropQuery = `
        DROP SCHEMA public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO postgres;
        GRANT ALL ON SCHEMA public TO public;
      `;

      await db.query(dropQuery);
      console.log('✅ Database reset completed');

    } catch (error) {
      console.error('❌ Database reset failed:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2] || 'migrate';
  const runner = new MigrationRunner();

  try {
    switch (command) {
      case 'migrate':
        await runner.migrate();
        break;
      case 'status':
        await runner.status();
        break;
      case 'reset':
        await runner.reset();
        break;
      default:
        console.log('Usage: npm run db:migrate [migrate|status|reset]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default MigrationRunner;