# Smart Contracts

Smart contracts for the Intent-Based Trading Aggregator, built with Foundry and Solidity.

## Overview

The smart contract layer provides the core settlement logic for intent-based trading, featuring:

- **Intent Settlement**: Atomic execution of user intents with competitive solver bids
- **EIP-712 Signatures**: Gasless intent creation with typed data signing
- **Permit2 Integration**: Token approvals without separate transactions
- **Slippage Protection**: On-chain enforcement of user-defined slippage limits
- **Solver Fee Distribution**: Automatic fee calculation and distribution

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  IntentSett-    │    │     Permit2     │    │   DEX Router    │
│  lement.sol     │◄──►│   (Uniswap)     │◄──►│   (Various)     │
│                 │    │                 │    │                 │
│ • Validate      │    │ • Token Pulls   │    │ • Route Exec.   │
│ • Execute       │    │ • Signatures    │    │ • Price Oracle  │
│ • Distribute    │    │ • Nonce Track   │    │ • Liquidity     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Contracts

### IntentSettlement.sol

The main settlement contract that handles intent execution with comprehensive security and gas optimizations.

**Key Functions:**
- `submitAndSettle()` - Execute an intent with winning solver bid using Permit2
- `isNonceUsed()` - Check if a nonce has been used
- `DOMAIN_SEPARATOR()` - Get EIP-712 domain separator
- `setFeeTreasury()` - Owner function to update fee treasury
- `setMaxFeeBps()` - Owner function to update maximum solver fee

**Events:**
- `IntentFilled` - Emitted when an intent is successfully executed
- `SolverPaid` - Emitted when solver receives their fee
- `RouterFailure` - Emitted when router call fails
- `ParameterUpdated` - Emitted when contract parameters are updated

**Security Features:**
- ReentrancyGuard protection on all external functions
- Comprehensive input validation
- Signature replay protection via nonce mapping
- Slippage protection with configurable limits
- Router call failure handling with detailed error reporting

### Interfaces

- **IIntentSettlement.sol** - Main contract interface with structs, events, and errors
- **IBidStructs.sol** - Core data structures for intents, bids, and execution results
- **IPermit2.sol** - Complete Permit2 interface including witness transfers
- **IRouter.sol** - Generic DEX router interface supporting various swap types

### Libraries

- **IntentHashLib.sol** - EIP-712 hashing utilities with signature verification

## Development

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+ (for package management)

### Setup

```bash
# Install Foundry dependencies
forge install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Building

```bash
# Compile contracts
forge build

# Compile with size optimization
forge build --sizes

# Watch for changes
forge build --watch
```

### Testing

```bash
# Run all tests
forge test

# Run tests with verbosity
forge test -vvv

# Run specific test file
forge test --match-contract IntentSettlementTest

# Run security tests
forge test --match-contract IntentSettlementSecurityTest

# Run tests with coverage
forge coverage

# Run fork tests
forge test --fork-url $XLAYER_RPC_URL

# Run fuzz tests with custom runs
forge test --fuzz-runs 10000

# Generate gas report
forge test --gas-report
```

### Test Suites

#### IntentSettlement.t.sol
- **Core Functionality**: Intent settlement, signature verification, router integration
- **Validation Tests**: Input validation, bid validation, slippage protection
- **Edge Cases**: Zero fees, maximum slippage, nonce replay protection
- **Gas Optimization**: Gas usage benchmarking and optimization verification
- **Fuzz Testing**: Property-based testing with random inputs

#### IntentSettlementSecurity.t.sol
- **Reentrancy Protection**: Tests against reentrancy attacks
- **Access Control**: Owner-only function protection
- **Integer Overflow**: Safe math operations verification
- **Signature Security**: Signature reuse and forgery protection
- **Router Security**: Malicious router protection
- **Edge Cases**: Zero values, maximum values, expired intents

#### Mock Contracts
- **Permit2Mock**: Simplified Permit2 implementation for testing
- **RouterMock**: Configurable DEX router with failure simulation
- **MaliciousRouter**: Router that attempts to steal funds
- **ReentrantToken**: ERC20 token that attempts reentrancy attacks

### Deployment

#### Testnet Deployment

```bash
# Deploy to X Layer testnet
forge script script/Deploy.s.sol \
  --rpc-url xlayer_testnet \
  --broadcast \
  --verify

# Verify contracts
forge verify-contract <CONTRACT_ADDRESS> \
  src/IntentSettlement.sol:IntentSettlement \
  --chain xlayer-testnet
```

#### Mainnet Deployment

```bash
# Deploy to X Layer mainnet (use --slow for better reliability)
forge script script/Deploy.s.sol \
  --rpc-url xlayer \
  --broadcast \
  --verify \
  --slow
```

### Verification

```bash
# Run verification script
forge script script/Verify.s.sol \
  --rpc-url xlayer \
  --broadcast

# Manual verification
forge verify-contract <CONTRACT_ADDRESS> \
  src/IntentSettlement.sol:IntentSettlement \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address)" $PERMIT2 $ROUTER $TREASURY $OWNER) \
  --etherscan-api-key $XLAYER_API_KEY \
  --chain xlayer
```

### Configuration

Key environment variables in `.env`:

```bash
# Deployment
PRIVATE_KEY=0x...
CONTRACT_OWNER=0x...
FEE_TREASURY=0x...

# Networks
XLAYER_RPC_URL=https://xlayerrpc.okx.com
XLAYER_TESTNET_RPC=https://testrpc.xlayer.tech

# External Contracts
PERMIT2_ADDRESS=0x000000000022D473030F116dDEE9F6B43aC78BA3
ROUTER_ADDRESS=0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45

# Verification
XLAYER_API_KEY=your-api-key
ETHERSCAN_API_KEY=your-etherscan-key
ARBISCAN_API_KEY=your-arbiscan-key
POLYGONSCAN_API_KEY=your-polygonscan-key
BASESCAN_API_KEY=your-basescan-key
OPTIMISM_API_KEY=your-optimism-key

# For verification script
SETTLEMENT_CONTRACT_ADDRESS=0x...
```

## Contract Addresses

### X Layer Mainnet
- **IntentSettlement**: `TBD`
- **Permit2**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

### X Layer Testnet
- **IntentSettlement**: `TBD`
- **Permit2**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

## Security

### Audit Status
- [x] Initial security review (internal)
- [x] Comprehensive test coverage (100% critical paths)
- [ ] Professional audit (recommended before mainnet)
- [ ] Bug bounty program (post-audit)

### Security Features
- **ReentrancyGuard**: Protection against reentrancy attacks on all external functions
- **Access Control**: Owner-based parameter management with proper validation
- **Input Validation**: Comprehensive parameter checking for all user inputs
- **Nonce Protection**: Replay attack prevention via user-specific nonce mapping
- **Fee Caps**: Maximum solver fee enforcement (30 bps default, owner configurable)
- **Signature Verification**: EIP-712 signature validation with domain separation
- **Router Protection**: Safe external calls with failure handling and revert reasons
- **Balance Tracking**: Precise token balance tracking to prevent fund loss

### Security Testing
- **Reentrancy Tests**: Verified protection against reentrancy attacks
- **Access Control Tests**: Unauthorized access prevention validation
- **Integer Overflow Tests**: Safe math operations with boundary testing
- **Signature Tests**: Signature replay, forgery, and cross-user protection
- **Router Security Tests**: Malicious router and fund theft protection
- **Fuzz Testing**: Property-based testing with random inputs (1000+ runs)

### Known Limitations
- Single router support per deployment (can deploy multiple contracts)
- Immutable contract design (no upgrades, deploy new version for changes)
- Manual fee parameter updates (could be automated with governance in future)
- Router allowlist not implemented (trusts any configured router address)

## Gas Optimization

The contracts are optimized for gas efficiency:

- **Packed Structs**: Efficient storage layout for Intent and BidLike structs
- **Minimal External Calls**: Reduced gas costs through batched operations
- **Optimized Storage**: Single storage slot updates where possible
- **Efficient Libraries**: Custom IntentHashLib for gas-optimized EIP-712 operations
- **Smart Approvals**: Approve/reset pattern for router interactions
- **Balance Difference**: Gas-efficient output amount calculation

Current gas estimates (with optimization runs = 1,000,000):
- `submitAndSettle()`: ~180,000-220,000 gas (varies by route complexity)
- EIP-712 signature verification: ~5,000 gas
- Router approval/reset: ~46,000 gas
- Event emissions: ~2,000 gas per event

Gas optimization profiles:
- **Development**: optimizer_runs = 1,000 (faster compilation)
- **Production**: optimizer_runs = 10,000,000 (maximum optimization)
- **Testing**: optimizer = false (better debugging)

## Integration

### For Frontend Developers

```typescript
import { IntentSettlement__factory } from './contracts/types';

const contract = IntentSettlement__factory.connect(
  SETTLEMENT_CONTRACT_ADDRESS,
  signer
);

// Submit intent for settlement
const tx = await contract.submitAndSettle(
  intent,
  userSignature,
  selectedBid,
  routerCalldata
);
```

### For Solver Developers

```typescript
// Generate router calldata for bid
const routerCalldata = await generateRouterCall(intent, quote);

// Submit bid to coordinator
const bid = {
  solver: solverAddress,
  quoteOut: quote.amountOut,
  solverFeeBps: calculateFee(),
  calldataHint: routerCalldata
};
```

## Implementation Details

### EIP-712 Integration
```solidity
// Domain separator
bytes32 public constant DOMAIN_SEPARATOR = keccak256(
    abi.encode(
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
        keccak256("IntentSwap"),
        keccak256("1"),
        block.chainid,
        address(this)
    )
);

// Intent type hash
bytes32 public constant INTENT_TYPEHASH = keccak256(
    "Intent(address tokenIn,address tokenOut,uint256 amountIn,uint16 maxSlippageBps,uint64 deadline,uint256 chainId,address receiver,uint256 nonce)"
);
```

### Permit2 Integration
```solidity
// Pull tokens via Permit2
IPermit2(permit2).permitTransferFrom(
    IPermit2.PermitTransferFrom({
        permitted: IPermit2.TokenPermissions({
            token: intent.tokenIn,
            amount: intent.amountIn
        }),
        nonce: intent.nonce,
        deadline: intent.deadline
    }),
    IPermit2.SignatureTransferDetails({
        to: address(this),
        requestedAmount: intent.amountIn
    }),
    intent.receiver,
    signature
);
```

## Testing Strategy

### Unit Tests (IntentSettlement.t.sol)
- **Core Functions**: `submitAndSettle()`, `isNonceUsed()`, owner functions
- **Validation Logic**: Input validation, bid validation, signature verification
- **Edge Cases**: Zero fees, maximum slippage, boundary conditions
- **Gas Benchmarking**: Gas usage measurement and optimization verification
- **Event Testing**: Proper event emission with correct parameters

### Security Tests (IntentSettlementSecurity.t.sol)
- **Reentrancy Protection**: Attack simulation with malicious contracts
- **Access Control**: Unauthorized access prevention testing
- **Integer Safety**: Overflow/underflow protection verification
- **Signature Security**: Replay, forgery, and cross-user attack prevention
- **Router Security**: Malicious router behavior and fund protection

### Property-Based Testing
- **Fuzz Testing**: Random input generation with 1000+ test runs
- **Invariant Testing**: Critical system properties verification
- **Boundary Testing**: Edge case exploration with extreme values

### Integration Tests
- **Full Flow Testing**: End-to-end intent settlement workflow
- **Multi-Contract Interaction**: Permit2, router, and settlement coordination
- **Real Router Integration**: Testing with actual DEX router contracts
- **Error Handling**: Comprehensive failure scenario testing

## Upgradeability

Current contracts are **immutable** for security and trust. Future versions may include:

- Proxy patterns for upgradeability
- Modular architecture
- Governance-controlled parameters
- Migration utilities

## Contributing

When contributing to contracts:

1. Write comprehensive tests for new features
2. Follow Solidity style guide
3. Add natspec documentation
4. Consider gas optimization
5. Update this README with changes

### Code Style

```solidity
// Follow these conventions:
contract MyContract {
    // State variables
    uint256 public constant MAX_FEE = 100;
    mapping(address => uint256) private _balances;
    
    // Events
    event SomethingHappened(address indexed user, uint256 amount);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    // Functions (external, public, internal, private)
    function externalFunction() external onlyOwner {
        // Implementation
    }
}
```

## Troubleshooting

### Common Issues

1. **Compilation Errors**
   ```bash
   # Clean cache and rebuild
   forge clean
   forge build
   ```

2. **Test Failures**
   ```bash
   # Run with debug info
   forge test -vvvv
   ```

3. **Deployment Issues**
   ```bash
   # Check gas estimates
   forge script script/Deploy.s.sol --estimate-gas
   ```

4. **Verification Problems**
   ```bash
   # Flatten contract for manual verification
   forge flatten src/IntentSettlement.sol
   ```

---

For more detailed information, see the [Architecture Documentation](../docs/architecture.md).