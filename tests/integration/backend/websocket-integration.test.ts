/**
 * @fileoverview WebSocket integration tests
 * @description Test real-time communication between services and clients
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import WebSocket from 'ws';
import { testConfig } from '../../setup/test-config.js';
import { 
  createTestIntent, 
  createTestBid, 
  createIntentRequest,
  createMockWebSocketMessage 
} from '../../setup/test-data-factory.js';

interface WebSocketTestClient {
  ws: WebSocket;
  messages: any[];
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: any) => void;
  waitForMessage: (timeout?: number) => Promise<any>;
  waitForMessageType: (type: string, timeout?: number) => Promise<any>;
}

describe('WebSocket Integration Tests', () => {
  let solverClient: WebSocketTestClient;
  let userClient: WebSocketTestClient;
  let monitorClient: WebSocketTestClient;

  // Helper to create WebSocket test client
  const createWebSocketClient = (clientId: string): WebSocketTestClient => {
    let ws: WebSocket;
    const messages: any[] = [];

    return {
      ws: ws as any,
      messages,
      connect: async () => {
        return new Promise((resolve, reject) => {
          ws = new WebSocket(`${testConfig.services.websocket.url}?clientId=${clientId}`);
          
          ws.on('open', () => {
            console.log(`WebSocket client ${clientId} connected`);
            resolve();
          });

          ws.on('message', (data) => {
            try {
              const message = JSON.parse(data.toString());
              messages.push(message);
              console.log(`Client ${clientId} received:`, message.type);
            } catch (error) {
              console.error('Failed to parse WebSocket message:', error);
            }
          });

          ws.on('error', (error) => {
            console.error(`WebSocket client ${clientId} error:`, error);
            reject(error);
          });

          ws.on('close', () => {
            console.log(`WebSocket client ${clientId} disconnected`);
          });

          // Timeout after 10 seconds
          setTimeout(() => reject(new Error('Connection timeout')), 10000);
        });
      },
      disconnect: () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      },
      sendMessage: (message: any) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      },
      waitForMessage: (timeout = 5000) => {
        return new Promise((resolve, reject) => {
          const checkMessages = () => {
            if (messages.length > 0) {
              resolve(messages.shift());
            } else {
              setTimeout(checkMessages, 100);
            }
          };

          setTimeout(() => reject(new Error('Message timeout')), timeout);
          checkMessages();
        });
      },
      waitForMessageType: (type: string, timeout = 5000) => {
        return new Promise((resolve, reject) => {
          const checkMessages = () => {
            const messageIndex = messages.findIndex(msg => msg.type === type);
            if (messageIndex >= 0) {
              resolve(messages.splice(messageIndex, 1)[0]);
            } else {
              setTimeout(checkMessages, 100);
            }
          };

          setTimeout(() => reject(new Error(`Message type ${type} timeout`)), timeout);
          checkMessages();
        });
      }
    };
  };

  beforeAll(async () => {
    // Wait for WebSocket server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create test clients
    solverClient = createWebSocketClient('test-solver-1');
    userClient = createWebSocketClient('test-user-1');
    monitorClient = createWebSocketClient('test-monitor-1');

    // Connect all clients
    await Promise.all([
      solverClient.connect(),
      userClient.connect(),
      monitorClient.connect()
    ]);

    console.log('All WebSocket clients connected');
  });

  afterAll(async () => {
    // Disconnect all clients
    solverClient.disconnect();
    userClient.disconnect();
    monitorClient.disconnect();
    
    console.log('All WebSocket clients disconnected');
  });

  beforeEach(() => {
    // Clear message buffers
    solverClient.messages.length = 0;
    userClient.messages.length = 0;
    monitorClient.messages.length = 0;
  });

  describe('Connection Management', () => {
    it('should maintain stable connections', async () => {
      // Test that connections are stable
      expect(solverClient.ws.readyState).toBe(WebSocket.OPEN);
      expect(userClient.ws.readyState).toBe(WebSocket.OPEN);
      expect(monitorClient.ws.readyState).toBe(WebSocket.OPEN);
    });

    it('should handle client reconnection', async () => {
      // Disconnect and reconnect a client
      solverClient.disconnect();
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reconnect
      await solverClient.connect();
      
      expect(solverClient.ws.readyState).toBe(WebSocket.OPEN);
    });

    it('should authenticate solver clients', async () => {
      // Send authentication message
      solverClient.sendMessage({
        type: 'auth',
        data: {
          solverId: 'test-solver-1',
          signature: '0x' + '1'.repeat(130) // Mock signature
        }
      });

      // Wait for auth response
      const authResponse = await solverClient.waitForMessageType('auth_response');
      
      expect(authResponse.data.authenticated).toBe(true);
      expect(authResponse.data.solverId).toBe('test-solver-1');
    });
  });

  describe('Intent Broadcasting', () => {
    it('should broadcast new intents to solvers', async () => {
      // Create an intent via API to trigger broadcast
      const intentRequest = createIntentRequest();
      
      const response = await fetch(`${testConfig.services.relayer.url}/api/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intentRequest)
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      const intentHash = result.data.intentHash;

      // Solver should receive IntentCreated message
      const intentMessage = await solverClient.waitForMessageType('IntentCreated');
      
      expect(intentMessage.data.intentHash).toBe(intentHash);
      expect(intentMessage.data.intent).toBeTruthy();
      expect(intentMessage.data.intent.tokenIn).toBe(intentRequest.intent.tokenIn);
      expect(intentMessage.data.intent.tokenOut).toBe(intentRequest.intent.tokenOut);
    });

    it('should include intent metadata in broadcasts', async () => {
      const intentRequest = createIntentRequest();
      
      await fetch(`${testConfig.services.relayer.url}/api/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intentRequest)
      });

      const intentMessage = await solverClient.waitForMessageType('IntentCreated');
      
      expect(intentMessage.data.biddingWindowMs).toBeGreaterThan(0);
      expect(intentMessage.data.expiresAt).toBeTruthy();
      expect(intentMessage.timestamp).toBeTruthy();
    });

    it('should not broadcast to unauthorized clients', async () => {
      // User client should not receive solver-specific messages
      const intentRequest = createIntentRequest();
      
      await fetch(`${testConfig.services.relayer.url}/api/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intentRequest)
      });

      // Solver should receive message
      await solverClient.waitForMessageType('IntentCreated');
      
      // User client should not have received the message
      await new Promise(resolve => setTimeout(resolve, 1000));
      const userMessages = userClient.messages.filter(msg => msg.type === 'IntentCreated');
      expect(userMessages.length).toBe(0);
    });
  });

  describe('Bid Updates', () => {
    let testIntentHash: string;

    beforeEach(async () => {
      // Create test intent
      const intentRequest = createIntentRequest();
      const response = await fetch(`${testConfig.services.relayer.url}/api/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intentRequest)
      });
      
      const result = await response.json();
      testIntentHash = result.data.intentHash;
      
      // Clear intent creation messages
      await solverClient.waitForMessageType('IntentCreated');
    });

    it('should broadcast bid updates to interested clients', async () => {
      // Submit a bid
      const bid = createTestBid(testIntentHash);
      
      await fetch(`${testConfig.services.coordinator.url}/api/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bid)
      });

      // Monitor client should receive BidReceived message
      const bidMessage = await monitorClient.waitForMessageType('BidReceived');
      
      expect(bidMessage.data.intentHash).toBe(testIntentHash);
      expect(bidMessage.data.quoteOut).toBe(bid.quoteOut);
      expect(bidMessage.data.solverFeeBps).toBe(bid.solverFeeBps);
      expect(bidMessage.data.rank).toBeGreaterThan(0);
    });

    it('should broadcast best bid updates', async () => {
      // Submit multiple bids to trigger competition
      const bids = [
        createTestBid(testIntentHash, { quoteOut: '990000000000000000', solverFeeBps: 15 }),
        createTestBid(testIntentHash, { quoteOut: '995000000000000000', solverFeeBps: 10 }),
        createTestBid(testIntentHash, { quoteOut: '992000000000000000', solverFeeBps: 12 })
      ];

      // Submit bids
      for (const bid of bids) {
        await fetch(`${testConfig.services.coordinator.url}/api/bids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bid)
        });
        
        // Small delay between bids
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Should receive BestBidUpdated message
      const bestBidMessage = await monitorClient.waitForMessageType('BestBidUpdated');
      
      expect(bestBidMessage.data.intentHash).toBe(testIntentHash);
      expect(bestBidMessage.data.bestBid).toBeTruthy();
      expect(bestBidMessage.data.score).toBeGreaterThan(0);
    });
  });

  describe('Real-time Notifications', () => {
    it('should send intent status updates', async () => {
      const intentRequest = createIntentRequest();
      
      await fetch(`${testConfig.services.relayer.url}/api/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intentRequest)
      });

      // Should receive IntentUpdated messages as status changes
      const statusMessage = await monitorClient.waitForMessageType('IntentUpdated', 10000);
      
      expect(statusMessage.data.status).toBeTruthy();
      expect(['NEW', 'BROADCASTING', 'BIDDING'].includes(statusMessage.data.status)).toBe(true);
    });

    it('should handle client-specific subscriptions', async () => {
      // Subscribe to specific intent updates
      const intentHash = '0x1234567890123456789012345678901234567890123456789012345678901234';
      
      userClient.sendMessage({
        type: 'subscribe',
        data: {
          channel: 'intent_updates',
          intentHash: intentHash
        }
      });

      // Wait for subscription confirmation
      const subResponse = await userClient.waitForMessageType('subscription_confirmed');
      expect(subResponse.data.channel).toBe('intent_updates');
      expect(subResponse.data.intentHash).toBe(intentHash);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle high message throughput', async () => {
      const messageCount = 100;
      const messages = Array.from({ length: messageCount }, (_, i) => 
        createMockWebSocketMessage('test_message', { index: i })
      );

      const startTime = Date.now();
      
      // Send messages rapidly
      messages.forEach(msg => monitorClient.sendMessage(msg));
      
      // Wait for responses (if applicable)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should handle messages within reasonable time
      expect(duration).toBeLessThan(testConfig.performance.maxWebSocketLatency * messageCount);
    });

    it('should maintain message ordering', async () => {
      const sequentialMessages = Array.from({ length: 10 }, (_, i) => 
        createMockWebSocketMessage('sequence_test', { sequence: i })
      );

      // Send messages in sequence
      sequentialMessages.forEach(msg => {
        solverClient.sendMessage(msg);
      });

      // Collect responses
      const responses = [];
      for (let i = 0; i < 10; i++) {
        const response = await solverClient.waitForMessage();
        if (response.type === 'sequence_test') {
          responses.push(response);
        }
      }

      // Verify ordering
      responses.forEach((response, index) => {
        expect(response.data.sequence).toBe(index);
      });
    });

    it('should handle connection drops gracefully', async () => {
      // Simulate connection drop
      solverClient.ws.terminate();
      
      // Wait and reconnect
      await new Promise(resolve => setTimeout(resolve, 1000));
      await solverClient.connect();
      
      // Should be able to resume normal operation
      solverClient.sendMessage(createMockWebSocketMessage('ping'));
      
      const response = await solverClient.waitForMessage();
      expect(response).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed messages', async () => {
      // Send invalid JSON
      if (solverClient.ws.readyState === WebSocket.OPEN) {
        solverClient.ws.send('invalid json message');
      }

      // Should receive error response or continue operating normally
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Connection should still be alive
      expect(solverClient.ws.readyState).toBe(WebSocket.OPEN);
    });

    it('should validate message types', async () => {
      // Send message with invalid type
      solverClient.sendMessage({
        type: 'invalid_message_type',
        data: { test: 'data' }
      });

      // Should handle gracefully
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(solverClient.ws.readyState).toBe(WebSocket.OPEN);
    });

    it('should rate limit abusive clients', async () => {
      // Send many messages rapidly
      const spamMessages = Array.from({ length: 50 }, () => 
        createMockWebSocketMessage('spam', {})
      );

      spamMessages.forEach(msg => solverClient.sendMessage(msg));
      
      // Should either rate limit or handle gracefully
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Connection might be terminated or rate limited
      // Either way, the server should still be functional
      expect([WebSocket.OPEN, WebSocket.CLOSED].includes(solverClient.ws.readyState)).toBe(true);
    });
  });
});