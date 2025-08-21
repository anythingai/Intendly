# Intent-Based Trading Aggregator

A competitive solver marketplace for optimal DeFi execution on Layer 2 networks, starting with X Layer.

[![CI/CD Pipeline](https://github.com/yourorg/intent-based-trading-aggregator/actions/workflows/ci.yml/badge.svg)](https://github.com/yourorg/intent-based-trading-aggregator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Solidity](https://img.shields.io/badge/Solidity-363636?logo=solidity&logoColor=white)](https://soliditylang.org/)

## 🌟 Overview

The Intent-Based Trading Aggregator revolutionizes DeFi trading by allowing users to express their **desired outcomes** rather than specifying execution paths. A competitive network of solvers competes to provide the best execution for each trade.

### Key Features

- **🎯 Intent-First UX**: Single signature flow with EIP-712 + Permit2
- **🏆 Competitive Execution**: Open solver market with transparent bidding
- **⚡ Atomic Settlement**: On-chain enforcement of user constraints
- **🌐 L2-First Design**: Optimized for X Layer with multi-L2 extensibility
- **📡 Real-time Coordination**: WebSocket-based intent broadcasting

## 📋 Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Foundry (for smart contracts)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourorg/intent-based-trading-aggregator.git
cd intent-based-trading-aggregator

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development environment
npm run dev
```

### Docker Setup

```bash
# Start all services with Docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend dApp │    │  Backend APIs   │    │ Smart Contracts │
│                 │    │                 │    │                 │
│  • Next.js 14   │◄──►│  • Relayer      │◄──►│  • Settlement   │
│  • Wagmi/Viem   │    │  • Coordinator  │    │  • Permit2      │
│  • Tailwind CSS │    │  • WebSocket    │    │  • Router       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   Solver SDK    │              │
         └──────────────►│                 │◄─────────────┘
                        │  • TypeScript   │
                        │  • Quote Agg.   │
                        │  • Bid Logic    │
                        └─────────────────┘
```

## 📁 Project Structure

```
intendly/
├── contracts/          # Smart contracts (Foundry)
│   ├── src/           # Solidity contracts
│   ├── test/          # Contract tests
│   └── script/        # Deployment scripts
├── backend/           # Backend services (Node.js/Express)
│   ├── src/
│   │   ├── relayer/   # Intent ingestion
│   │   ├── coordinator/ # Bid coordination
│   │   └── shared/    # Common utilities
│   └── migrations/    # Database migrations
├── web/               # Frontend dApp (Next.js)
│   ├── app/           # App Router pages
│   ├── components/    # React components
│   ├── hooks/         # Custom hooks
│   └── lib/           # Utilities & configs
├── solver-sdk/        # TypeScript SDK for solvers
│   ├── src/           # SDK source code
│   ├── examples/      # Example solvers
│   └── docs/          # SDK documentation
├── docs/              # Project documentation
└── scripts/           # Utility scripts
```

## 🚀 Development

### Running Components

```bash
# Start all services
npm run dev

# Start individual components
npm run dev:contracts    # Foundry watch mode
npm run dev:backend     # Backend with hot reload
npm run dev:web         # Next.js development server
npm run dev:solver      # Example solver
```

### Testing

```bash
# Run all tests
npm test

# Test individual components
npm run test -w contracts    # Smart contract tests
npm run test -w backend      # Backend tests
npm run test -w web          # Frontend tests
npm run test -w solver-sdk   # SDK tests
```

### Code Quality

```bash
# Lint all code
npm run lint

# Format code
npm run format

# Type checking
npm run type-check
```

## 📚 Documentation

- **[📖 Full Documentation](./docs/README.md)** - Complete project documentation
- **[🏛️ Architecture Guide](./docs/architecture.md)** - System design and architecture
- **[🔧 API Reference](./docs/api-reference.md)** - REST API and WebSocket documentation
- **[🤖 Solver Guide](./docs/solver-guide.md)** - Building and running solvers
- **[🚢 Deployment Guide](./docs/deployment.md)** - Deployment and infrastructure
- **[🎬 Demo Script](./docs/demo-script.md)** - Demo scenarios and testing

## 🔧 Components

### Smart Contracts
Foundry-based smart contracts for intent settlement with EIP-712 signatures and Permit2 integration.

[→ View Contracts Documentation](./contracts/README.md)

### Backend Services
Node.js/Express services handling intent ingestion, bid coordination, and real-time communication.

[→ View Backend Documentation](./backend/README.md)

### Frontend dApp
Next.js 14 application providing the user interface for intent-based trading.

[→ View Frontend Documentation](./web/README.md)

### Solver SDK
TypeScript SDK for building competitive solvers with quote aggregation and bidding logic.

[→ View SDK Documentation](./solver-sdk/README.md)

## 🌍 Deployment

### Supported Networks

- **X Layer Mainnet** (Chain ID: 196)
- **X Layer Testnet** (Chain ID: 195)
- *More L2s coming soon*

### Environment Configurations

- **Development**: Local development with Docker Compose
- **Staging**: Testing environment with full feature set
- **Production**: Production deployment with monitoring and security

### Deployment Infrastructure

The project includes comprehensive deployment infrastructure:

- **🐳 Containerization**: Multi-stage Docker builds with production optimization
- **☸️ Kubernetes**: Production-ready manifests with auto-scaling and health checks
- **🏗️ Infrastructure as Code**: Terraform configurations for AWS deployment
- **🔄 CI/CD Pipeline**: GitHub Actions with automated testing and deployment
- **📊 Monitoring Stack**: Prometheus, Grafana, Loki, and AlertManager
- **🔒 Security**: SSL/TLS setup, secrets management, and security scanning
- **📚 Documentation**: Comprehensive guides for users, developers, and operators

#### Quick Deployment

```bash
# Validate deployment readiness
./deployment/scripts/validate-deployment.sh production

# Deploy infrastructure
cd deployment/terraform/aws && terraform apply

# Deploy application
./deployment/scripts/deploy.sh production

# Validate deployment
./deployment/scripts/health-check.sh production
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests and ensure they pass
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Standards

- **TypeScript** for all JavaScript/Node.js code
- **Solidity 0.8.19+** for smart contracts
- **ESLint + Prettier** for code formatting
- **Comprehensive testing** for all components

## 📊 Performance Targets

- **Intent Broadcast**: <500ms
- **First Solver Bid**: <2s
- **Bid Window**: 2-3s
- **Settlement**: <30s
- **End-to-End UX**: <2 minutes

## 🔒 Security

- **Smart Contract Audits**: Professional security audits
- **Dependency Scanning**: Automated vulnerability checks
- **Code Analysis**: Static analysis with Slither
- **Access Controls**: Role-based permissions
- **Rate Limiting**: API protection mechanisms

Report security vulnerabilities to: security@intendly.xyz

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Website**: [https://intendly.xyz](https://intendly.xyz)
- **Documentation**: [https://docs.intendly.xyz](https://docs.intendly.xyz)
- **Discord**: [https://discord.gg/intendly](https://discord.gg/intendly)
- **Twitter**: [https://twitter.com/intendly](https://twitter.com/intendly)

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yourorg/intent-based-trading-aggregator&type=Date)](https://star-history.com/#yourorg/intent-based-trading-aggregator&Date)

---

**Built with ❤️ for the DeFi community**

*Intent-based trading is the future of DeFi. Join us in building it.*