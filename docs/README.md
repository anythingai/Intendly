# Intent-Based Trading Aggregator Documentation

Welcome to the documentation for the Intent-Based Trading Aggregator on L2s.

## Overview

The Intent-Based Trading Aggregator is a competitive solver marketplace that enables optimal DeFi execution through intent-based trading. Users express their desired outcomes, and a network of solvers competes to provide the best execution.

## Documentation Structure

- [`architecture.md`](./architecture.md) - System architecture and design decisions
- [`api-reference.md`](./api-reference.md) - Complete API documentation
- [`solver-guide.md`](./solver-guide.md) - Guide for building and running solvers
- [`deployment.md`](./deployment.md) - Deployment and infrastructure guide
- [`demo-script.md`](./demo-script.md) - Demo walkthrough and testing scenarios

## Quick Start

### For Users
1. Connect your wallet to the dApp
2. Specify your trading intent (token swap, amount, slippage tolerance)
3. Sign the intent with EIP-712
4. Watch solvers compete for your trade
5. Execute the best bid

### For Solvers
1. Install the Solver SDK: `npm install @intendly/solver-sdk`
2. Follow the [Solver Guide](./solver-guide.md)
3. Register your solver with the network
4. Start competing for intents

### For Developers
1. Clone the repository
2. Follow the [Deployment Guide](./deployment.md)
3. Review the [Architecture Documentation](./architecture.md)
4. Check the [API Reference](./api-reference.md)

## Key Features

- **Intent-First UX**: Single signature flow with EIP-712 + Permit2
- **Competitive Execution**: Open solver market with transparent bidding
- **Atomic Settlement**: On-chain enforcement of user constraints
- **L2-First Design**: Optimized for X Layer with multi-L2 extensibility
- **Real-time Coordination**: WebSocket-based intent broadcasting

## Technology Stack

- **Smart Contracts**: Solidity 0.8.19+ with Foundry
- **Backend**: Node.js 18+ with Express and TypeScript
- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **SDK**: TypeScript library for solver development
- **Infrastructure**: Docker, PostgreSQL, Redis, WebSocket

## Contributing

Please read our contributing guidelines and code of conduct before submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Join our Discord community
- Check the documentation

---

*Built for hackathons, designed for production.*