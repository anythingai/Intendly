# Intent-Based Trading Aggregator - Demo Execution Guide

Complete guide for executing the PRD Section 24 demo and comprehensive system validation.

## 🎯 Quick Start

### Prerequisites Verification
```bash
# Verify system requirements
node --version    # >= 18.0.0
npm --version     # >= 9.0.0
docker --version  # >= 20.0.0
docker-compose --version # >= 2.0.0

# Check available resources
free -h          # >= 8GB RAM recommended
df -h            # >= 10GB disk space
```

### 1-Minute Demo Setup
```bash
# Clone and setup
git clone <repository-url>
cd intent-based-trading-aggregator/demo

# Install dependencies
npm install

# Start complete demo environment
npm run demo:presentation

# Wait for services (2-3 minutes)
npm run demo:health

# Execute PRD Section 24 demo
npm run demo:start
```

## 📋 PRD Section 24 Demo Script

The complete demo follows these exact steps from the PRD:

### Step 1: Connect Wallet & Choose X Layer
```bash
# Demo shows:
# - Wallet connection interface
# - X Layer network selection (Chain ID 196)
# - Address confirmation: 0x742D35Cc...
```

### Step 2: Fill Intent Form
```bash
# Demo fills:
# - Token In: 0.5 ETH
# - Token Out: USDC  
# - Max Slippage: 0.5%
# - Deadline: now + 5 minutes
```

### Step 3: Sign Intent
```bash
# Demo shows:
# - EIP-712 signature dialog
# - Intent hash generation
# - Submission to relayer
```

### Step 4: Watch Solver Competition
```bash
# Demo displays:
# - Real-time bid arrivals (< 3 seconds)
# - Minimum 2 solvers competing
# - Bid comparison table
```

### Step 5: Show Best Bid & Explain Fee
```bash
# Demo highlights:
# - Winning solver selection
# - Fee structure explanation  
# - Price improvement calculation
```

### Step 6: Execute Settlement
```bash
# Demo executes:
# - Settlement contract call
# - Token transfer via Permit2
# - Atomic execution completion
```

### Step 7: Show Explorer Link
```bash
# Demo opens:
# - Block explorer transaction
# - Settlement details
# - Gas usage information
```

### Step 8: Display Results & Metrics
```bash
# Demo presents:
# - Final token amounts
# - Price improvement achieved
# - Savings vs baseline
# - Performance metrics
```

## 🚀 Environment Management

### Demo Environment Profiles

#### Minimal Demo (Development)
```bash
npm run demo:minimal
# Services: Core backend, 2 solvers, basic frontend
# Memory: ~2GB RAM
# Startup: ~60 seconds
```

#### Full Demo (Testing)
```bash
npm run demo:full
# Services: All components + monitoring
# Memory: ~4GB RAM  
# Startup: ~120 seconds
```

#### Presentation Demo (Production-Ready)
```bash
npm run demo:presentation
# Services: Optimized for live demos
# Memory: ~3GB RAM
# Startup: ~90 seconds
```

### Service Health Monitoring
```bash
# Check all services
npm run demo:health

# View service logs
npm run demo:logs

# Monitor specific service
docker logs -f intendly-relayer-demo
```

### Environment Reset
```bash
# Quick reset (keeps images)
npm run demo:stop && npm run demo:presentation

# Full reset (rebuilds everything)
npm run reset

# Clean restart
npm run demo:stop
docker system prune -f
npm run demo:presentation
```

## 📊 Validation & Testing

### PRD Compliance Validation
```bash
# Validate all 24 PRD acceptance criteria
npm run validate:prd

# Expected results:
# ✅ P0 Critical Requirements: 19/19 passed
# ✅ P1 Important Requirements: 5/5 passed  
# 🎉 SYSTEM IS FULLY PRD COMPLIANT
```

### Performance Benchmarking
```bash
# Run performance validation
npm run validate:performance

# Validates:
# - Intent processing: <500ms
# - Bid collection: <3s
# - Settlement: <30s
# - End-to-end: <2min
# - Success rate: ≥99%
```

### Integration Testing
```bash
# Complete system integration
npm run validate:system

# Tests:
# - Frontend ↔ Backend connectivity
# - Multi-solver competition
# - WebSocket real-time updates
# - Smart contract integration
# - Error handling & recovery
```

## 🎭 Demo Scenarios

### Primary Demo Scenario
```bash
npm run scenario:primary
# PRD Section 24: 0.5 ETH → USDC
# Expected: <2min, ≥2 solvers, ≤0.5% slippage, ≥20bps improvement
```

### Alternative Demo Scenarios
```bash
# High-volume competition
npm run scenario:competition
# Tests: 10 ETH trade, 3+ solvers, competitive bidding

# Reliability testing  
npm run scenario:reliability
# Tests: 20 consecutive swaps, ≥99% success rate

# Blue-chip token pairs
npm run scenario:bluechip
# Tests: ETH/USDC reliability and performance
```

## 📈 Monitoring & Analytics

### Real-Time Monitoring
```bash
# Start monitoring services
npm run monitoring:start

# Access dashboards:
# - Grafana: http://localhost:3003 (admin/demo)
# - Prometheus: http://localhost:9090
# - Demo Controller: http://localhost:3004
```

### Key Metrics Tracked
- **Intent Processing**: Creation, validation, broadcasting times
- **Solver Competition**: Bid counts, response times, win rates  
- **Settlement Performance**: Execution times, gas usage, success rates
- **User Experience**: Flow completion rates, error frequencies
- **System Health**: Service uptime, resource usage, error rates

### Generated Reports
```bash
# Generate comprehensive reports
npm run reports:generate

# Reports created:
# - reports/integration-report.json
# - reports/prd-compliance-report.json  
# - reports/performance-benchmarks.json
# - reports/demo-readiness-report.html
```

## 🎪 Live Demo Presentation

### Pre-Demo Checklist (15 minutes before)
```bash
# 1. Environment health check
npm run demo:health
# All services should show ✅ HEALTHY

# 2. Reset to clean state  
npm run reset
# Wait for full startup (~2 minutes)

# 3. Verify demo scenario
npm run scenario:primary --dry-run
# Should complete without errors

# 4. Open monitoring dashboard
# http://localhost:3003 (for live metrics)

# 5. Prepare backup scenarios
# Have alternative token pairs ready
```

### During Demo Execution
```bash
# Start interactive demo
npm run demo:start

# Follow prompts:
# 👤 Presenter: [Your Name]
# 👥 Audience: [Audience Type]
# 🚀 Executing complete PRD Section 24 demo walkthrough...

# Demo will guide through all 8 steps automatically
# Real-time progress and metrics displayed
# Automatic validation against PRD requirements
```

### Demo Recovery Procedures
```bash
# If demo fails at any step:

# Option 1: Continue with simulated data
# Demo automatically offers to continue

# Option 2: Quick restart
npm run demo:stop
npm run demo:presentation
npm run demo:start

# Option 3: Switch to backup scenario  
npm run scenario:competition

# Option 4: Use pre-recorded video
# Located in demo/assets/demo-recording.mp4
```

## 🔧 Troubleshooting

### Common Issues

#### Services Not Starting
```bash
# Check Docker resources
docker system df
docker system prune -f

# Restart Docker daemon
sudo systemctl restart docker

# Check port conflicts
lsof -i :3000 -i :3001 -i :3002
```

#### Solver Bids Not Appearing  
```bash
# Check solver logs
docker logs intendly-solver-1-demo
docker logs intendly-solver-2-demo

# Verify WebSocket connectivity
wscat -c ws://localhost:3002

# Restart solver services
docker restart intendly-solver-1-demo intendly-solver-2-demo
```

#### Frontend Not Loading
```bash
# Check frontend service
curl http://localhost:3000

# Verify environment variables
docker exec intendly-frontend-demo env | grep NEXT_PUBLIC

# Rebuild frontend
docker-compose -f environment/docker-compose.demo.yml up --build frontend-demo
```

#### Performance Issues
```bash
# Check system resources
docker stats

# Reduce service load
npm run demo:minimal

# Adjust timeout values
export DEMO_TIMEOUT_MULTIPLIER=2
npm run demo:start
```

### Debug Mode
```bash
# Enable verbose logging
export DEBUG=intendly:*
export LOG_LEVEL=debug
npm run demo:start

# Check all service health
npm run demo:health --verbose

# View detailed system status
docker-compose -f environment/docker-compose.demo.yml ps
```

## 📚 Additional Resources

### Documentation Links
- **[Architecture Overview](../docs/architecture.md)**: System design and components
- **[API Reference](../docs/api-reference.md)**: REST API and WebSocket documentation  
- **[Solver Guide](../docs/solver-guide.md)**: Building and integrating solvers
- **[Deployment Guide](../docs/deployment.md)**: Production deployment instructions

### Demo Materials
- **[Presentation Slides](./presentation/)**: Stakeholder-specific materials
- **[Q&A Preparation](./scripts/qa-preparation.md)**: Common questions and answers
- **[Demo Videos](./assets/)**: Pre-recorded demo scenarios
- **[Performance Reports](./reports/)**: Historical performance data

### Support Channels
- **GitHub Issues**: Technical problems and feature requests
- **Discord Community**: Real-time support and discussions
- **Documentation Site**: Complete guides and tutorials
- **Demo Feedback**: Continuous improvement suggestions

---

## 🎯 Success Criteria Validation

Upon completion, the demo environment validates:

### ✅ PRD Section 23 Acceptance Criteria
- Complete 0.5 ETH → USDC swap on X Layer with ≤0.5% slippage
- Within 2 clicks post-wallet connection  
- At least 2 solver bids visible within 3s, best bid auto-selected
- Settlement tx succeeds with achieved amountOut displayed
- All core events emitted, logs available, contracts verified

### ✅ Performance Requirements  
- **Intent processing**: <500ms ✅
- **Bid collection**: <3s ✅
- **Settlement**: <30s ✅
- **End-to-end**: <2min ✅
- **Success rate**: ≥99% ✅
- **Price improvement**: ≥20 bps ✅

### ✅ Demo Readiness
- Complete environment automation ✅
- Multi-scenario support ✅
- Real-time monitoring ✅
- Error recovery procedures ✅
- Comprehensive validation ✅

**Status**: 🎉 **DEMO ENVIRONMENT READY FOR PRODUCTION**

The Intent-Based Trading Aggregator demo environment fully meets all PRD requirements and is ready for stakeholder presentations, technical reviews, and production deployment validation.