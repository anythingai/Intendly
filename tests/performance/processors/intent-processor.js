/**
 * @fileoverview Artillery.js processor for intent load testing
 * @description Custom functions for generating realistic test data
 */

const crypto = require('crypto');

/**
 * Generate random hex string
 */
function randomHex(length) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate random Ethereum address
 */
function randomAddress() {
  return '0x' + randomHex(20);
}

/**
 * Generate mock EIP-712 signature
 */
function mockSignature() {
  return '0x' + randomHex(65);
}

/**
 * Generate realistic intent data for load testing
 */
function generateIntentData(requestParams, context, ee, next) {
  // Generate unique nonce based on timestamp and random data
  const nonce = Date.now().toString() + randomHex(4);
  
  // Generate random receiver address
  const receiver = randomAddress();
  
  // Set deadline to 1 hour from now
  const deadline = Math.floor(Date.now() / 1000 + 3600).toString();
  
  // Generate mock signature
  const signature = mockSignature();
  
  // Add to context for use in request
  context.vars.nonce = nonce;
  context.vars.receiver = receiver;
  context.vars.deadline = deadline;
  context.vars.signature = signature;
  
  return next();
}

/**
 * Validate intent creation response
 */
function validateIntentResponse(requestParams, response, context, ee, next) {
  if (response.statusCode !== 201) {
    ee.emit('counter', 'intent_creation_failed', 1);
    return next();
  }
  
  try {
    const body = JSON.parse(response.body);
    
    if (!body.data || !body.data.intentHash) {
      ee.emit('counter', 'invalid_response_format', 1);
      return next();
    }
    
    // Track successful intent creation
    ee.emit('counter', 'intent_created_successfully', 1);
    
    // Track bidding window time
    if (body.data.biddingWindowMs) {
      ee.emit('histogram', 'bidding_window_ms', body.data.biddingWindowMs);
    }
    
  } catch (error) {
    ee.emit('counter', 'response_parse_error', 1);
  }
  
  return next();
}

/**
 * Generate bid submission data
 */
function generateBidData(requestParams, context, ee, next) {
  // Generate solver address
  const solver = randomAddress();
  
  // Generate realistic quote (90-99% of input amount)
  const baseAmount = BigInt('1000000000000000000'); // 1 ETH
  const variation = BigInt(Math.floor(Math.random() * 100000000000000000)); // 0-0.1 ETH variation
  const quoteOut = (baseAmount - variation).toString();
  
  // Generate solver fee (5-50 basis points)
  const solverFeeBps = Math.floor(Math.random() * 45) + 5;
  
  // Generate calldata hint
  const calldataHint = '0x' + randomHex(100);
  
  // Generate solver signature
  const solverSig = mockSignature();
  
  context.vars.solver = solver;
  context.vars.quoteOut = quoteOut;
  context.vars.solverFeeBps = solverFeeBps;
  context.vars.calldataHint = calldataHint;
  context.vars.solverSig = solverSig;
  context.vars.ttlMs = 3000;
  
  return next();
}

/**
 * Validate bid submission response
 */
function validateBidResponse(requestParams, response, context, ee, next) {
  if (response.statusCode !== 201) {
    ee.emit('counter', 'bid_submission_failed', 1);
    return next();
  }
  
  try {
    const body = JSON.parse(response.body);
    
    if (!body.data || typeof body.data.accepted !== 'boolean') {
      ee.emit('counter', 'invalid_bid_response', 1);
      return next();
    }
    
    if (body.data.accepted) {
      ee.emit('counter', 'bid_accepted', 1);
      
      // Track bid rank if available
      if (body.data.rank) {
        ee.emit('histogram', 'bid_rank', body.data.rank);
      }
    } else {
      ee.emit('counter', 'bid_rejected', 1);
    }
    
  } catch (error) {
    ee.emit('counter', 'bid_response_parse_error', 1);
  }
  
  return next();
}

/**
 * Simulate WebSocket connection for real-time updates
 */
function simulateWebSocketConnection(requestParams, context, ee, next) {
  // In a real load test, this would establish WebSocket connections
  // For now, we'll just track the attempt
  ee.emit('counter', 'websocket_connection_attempt', 1);
  
  // Simulate connection delay
  setTimeout(() => {
    ee.emit('counter', 'websocket_connected', 1);
    next();
  }, Math.random() * 100 + 50); // 50-150ms delay
}

/**
 * Track response time metrics
 */
function trackResponseTime(requestParams, response, context, ee, next) {
  const responseTime = response.timings ? 
    response.timings.phases.total : 
    (response.responseTime || 0);
  
  ee.emit('histogram', 'api_response_time', responseTime);
  
  // Track by endpoint
  const endpoint = requestParams.url || 'unknown';
  ee.emit('histogram', `response_time_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`, responseTime);
  
  return next();
}

/**
 * Generate complex trading scenario
 */
function generateTradingScenario(requestParams, context, ee, next) {
  const scenarios = [
    {
      name: 'small_trade',
      weight: 40,
      amountIn: '100000000000000000', // 0.1 ETH
      maxSlippageBps: 50
    },
    {
      name: 'medium_trade',
      weight: 35,
      amountIn: '1000000000000000000', // 1 ETH
      maxSlippageBps: 100
    },
    {
      name: 'large_trade',
      weight: 20,
      amountIn: '10000000000000000000', // 10 ETH
      maxSlippageBps: 200
    },
    {
      name: 'whale_trade',
      weight: 5,
      amountIn: '100000000000000000000', // 100 ETH
      maxSlippageBps: 500
    }
  ];
  
  // Select scenario based on weights
  const random = Math.random() * 100;
  let cumulative = 0;
  let selectedScenario = scenarios[0];
  
  for (const scenario of scenarios) {
    cumulative += scenario.weight;
    if (random <= cumulative) {
      selectedScenario = scenario;
      break;
    }
  }
  
  context.vars.amountIn = selectedScenario.amountIn;
  context.vars.maxSlippageBps = selectedScenario.maxSlippageBps;
  context.vars.scenario = selectedScenario.name;
  
  ee.emit('counter', `scenario_${selectedScenario.name}`, 1);
  
  return next();
}

/**
 * Simulate solver competition
 */
function simulateSolverCompetition(requestParams, context, ee, next) {
  // Generate multiple bids for competition
  const numBids = Math.floor(Math.random() * 5) + 2; // 2-6 bids
  
  context.vars.expectedBids = numBids;
  ee.emit('histogram', 'solver_competition_bids', numBids);
  
  return next();
}

/**
 * Check system health during load test
 */
function checkSystemHealth(requestParams, response, context, ee, next) {
  if (response.statusCode !== 200) {
    ee.emit('counter', 'health_check_failed', 1);
    return next();
  }
  
  try {
    const body = JSON.parse(response.body);
    
    if (body.status === 'healthy') {
      ee.emit('counter', 'system_healthy', 1);
    } else {
      ee.emit('counter', 'system_unhealthy', 1);
    }
    
    // Track dependency health
    if (body.dependencies) {
      Object.keys(body.dependencies).forEach(dep => {
        const status = body.dependencies[dep] ? 'healthy' : 'unhealthy';
        ee.emit('counter', `dependency_${dep}_${status}`, 1);
      });
    }
    
  } catch (error) {
    ee.emit('counter', 'health_response_parse_error', 1);
  }
  
  return next();
}

module.exports = {
  generateIntentData,
  validateIntentResponse,
  generateBidData,
  validateBidResponse,
  simulateWebSocketConnection,
  trackResponseTime,
  generateTradingScenario,
  simulateSolverCompetition,
  checkSystemHealth
};