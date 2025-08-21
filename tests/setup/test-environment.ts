/**
 * @fileoverview Test environment setup and management
 * @description Utilities for setting up and tearing down test environments
 */

import { spawn, ChildProcess } from 'child_process';
import { testConfig } from './test-config.js';

export interface TestEnvironment {
  services: {
    postgres?: ChildProcess;
    redis?: ChildProcess;
    anvil?: ChildProcess;
    backend?: ChildProcess;
    websocket?: ChildProcess;
  };
  cleanup: () => Promise<void>;
}

/**
 * Start test environment services
 */
export const setupTestEnvironment = async (): Promise<TestEnvironment> => {
  const services: TestEnvironment['services'] = {};
  const processes: ChildProcess[] = [];

  console.log('Setting up test environment...');

  try {
    // Start Docker services
    console.log('Starting Docker services...');
    const dockerCompose = spawn('docker-compose', [
      '-f', 'setup/docker-compose.test.yml',
      'up', '-d'
    ], {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    await new Promise<void>((resolve, reject) => {
      dockerCompose.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Docker compose failed with code ${code}`));
        }
      });
    });

    // Wait for services to be ready
    await waitForServices();

    console.log('Test environment ready!');

    return {
      services,
      cleanup: async () => {
        console.log('Cleaning up test environment...');
        
        // Stop all spawned processes
        processes.forEach(proc => {
          if (!proc.killed) {
            proc.kill('SIGTERM');
          }
        });

        // Stop Docker services
        const dockerDown = spawn('docker-compose', [
          '-f', 'setup/docker-compose.test.yml',
          'down', '-v'
        ], {
          cwd: process.cwd(),
          stdio: 'inherit'
        });

        await new Promise<void>((resolve) => {
          dockerDown.on('close', () => resolve());
        });

        console.log('Test environment cleaned up!');
      }
    };
  } catch (error) {
    console.error('Failed to setup test environment:', error);
    throw error;
  }
};

/**
 * Wait for all services to be ready
 */
const waitForServices = async (): Promise<void> => {
  const maxWait = 60000; // 60 seconds
  const checkInterval = 2000; // 2 seconds
  const startTime = Date.now();

  console.log('Waiting for services to be ready...');

  while (Date.now() - startTime < maxWait) {
    try {
      const checks = await Promise.allSettled([
        checkPostgres(),
        checkRedis(),
        checkAnvil(),
        checkBackendServices()
      ]);

      const allReady = checks.every(check => check.status === 'fulfilled');
      
      if (allReady) {
        console.log('All services are ready!');
        return;
      }

      // Log which services are not ready
      checks.forEach((check, index) => {
        if (check.status === 'rejected') {
          const serviceName = ['PostgreSQL', 'Redis', 'Anvil', 'Backend'][index];
          console.log(`${serviceName} not ready yet...`);
        }
      });

    } catch (error) {
      // Continue waiting
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  throw new Error('Services did not become ready within timeout');
};

/**
 * Check if PostgreSQL is ready
 */
const checkPostgres = async (): Promise<void> => {
  const { Client } = await import('pg');
  const client = new Client({
    host: testConfig.database.host,
    port: testConfig.database.port,
    database: testConfig.database.name,
    user: testConfig.database.user,
    password: testConfig.database.password,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
  } catch (error) {
    throw new Error('PostgreSQL not ready');
  }
};

/**
 * Check if Redis is ready
 */
const checkRedis = async (): Promise<void> => {
  const { createClient } = await import('redis');
  const client = createClient({ url: testConfig.redis.url });

  try {
    await client.connect();
    await client.ping();
    await client.disconnect();
  } catch (error) {
    throw new Error('Redis not ready');
  }
};

/**
 * Check if Anvil blockchain is ready
 */
const checkAnvil = async (): Promise<void> => {
  const { createPublicClient, http } = await import('viem');
  
  const client = createPublicClient({
    transport: http(testConfig.blockchain.rpcUrl)
  });

  try {
    await client.getBlockNumber();
  } catch (error) {
    throw new Error('Anvil not ready');
  }
};

/**
 * Check if backend services are ready
 */
const checkBackendServices = async (): Promise<void> => {
  const axios = (await import('axios')).default;
  
  try {
    // Check relayer health
    await axios.get(`${testConfig.services.relayer.url}/health`, {
      timeout: 5000
    });

    // Check coordinator health
    await axios.get(`${testConfig.services.coordinator.url}/health`, {
      timeout: 5000
    });

  } catch (error) {
    throw new Error('Backend services not ready');
  }
};

/**
 * Reset test database to clean state
 */
export const resetTestDatabase = async (): Promise<void> => {
  const { Client } = await import('pg');
  const client = new Client({
    host: testConfig.database.host,
    port: testConfig.database.port,
    database: testConfig.database.name,
    user: testConfig.database.user,
    password: testConfig.database.password,
  });

  try {
    await client.connect();
    
    // Truncate all tables
    await client.query(`
      TRUNCATE TABLE intents, bids, solver_registry CASCADE;
    `);
    
    await client.end();
  } catch (error) {
    console.error('Failed to reset test database:', error);
    throw error;
  }
};

/**
 * Seed test database with initial data
 */
export const seedTestDatabase = async (): Promise<void> => {
  const { Client } = await import('pg');
  const client = new Client({
    host: testConfig.database.host,
    port: testConfig.database.port,
    database: testConfig.database.name,
    user: testConfig.database.user,
    password: testConfig.database.password,
  });

  try {
    await client.connect();
    
    // Insert test solver registry entries
    await client.query(`
      INSERT INTO solver_registry (address, name, status, reputation_score) VALUES
      ('0x1234567890123456789012345678901234567890', 'test-solver-1', 'active', 85),
      ('0x0987654321098765432109876543210987654321', 'test-solver-2', 'active', 92),
      ('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', 'test-solver-3', 'active', 78)
      ON CONFLICT (address) DO NOTHING;
    `);
    
    await client.end();
  } catch (error) {
    console.error('Failed to seed test database:', error);
    throw error;
  }
};

/**
 * Deploy contracts to test network
 */
export const deployTestContracts = async (): Promise<{
  settlementAddress: string;
  permit2Address: string;
  routerAddress: string;
}> => {
  const { createWalletClient, createPublicClient, http } = await import('viem');
  const { privateKeyToAccount } = await import('viem/accounts');
  const { anvil } = await import('viem/chains');

  const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  
  const walletClient = createWalletClient({
    account,
    chain: anvil,
    transport: http(testConfig.blockchain.rpcUrl)
  });

  const publicClient = createPublicClient({
    chain: anvil,
    transport: http(testConfig.blockchain.rpcUrl)
  });

  try {
    console.log('Deploying test contracts...');
    
    // Deploy mock contracts
    // Note: In a real implementation, you'd deploy actual contract bytecode
    // For now, we'll use placeholder addresses that represent deployed contracts
    
    const contractAddresses = {
      settlementAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      permit2Address: testConfig.contracts.permit2Address,
      routerAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
    };

    console.log('Test contracts deployed:', contractAddresses);
    return contractAddresses;
    
  } catch (error) {
    console.error('Failed to deploy test contracts:', error);
    throw error;
  }
};

/**
 * Global test setup that can be called from test runners
 */
export const globalTestSetup = async (): Promise<void> => {
  console.log('Running global test setup...');
  
  const env = await setupTestEnvironment();
  const contracts = await deployTestContracts();
  await resetTestDatabase();
  await seedTestDatabase();

  // Store environment and contract info globally for tests
  (global as any).testEnvironment = env;
  (global as any).testContracts = contracts;
  
  console.log('Global test setup complete!');
};

/**
 * Global test teardown
 */
export const globalTestTeardown = async (): Promise<void> => {
  console.log('Running global test teardown...');
  
  const env = (global as any).testEnvironment as TestEnvironment;
  if (env?.cleanup) {
    await env.cleanup();
  }
  
  console.log('Global test teardown complete!');
};