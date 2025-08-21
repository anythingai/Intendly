// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IBidStructs
 * @notice Interface defining bid and intent data structures
 * @dev Shared structures used across the intent settlement system
 */
interface IBidStructs {
    // ============ Intent Structures ============

    /**
     * @notice Core intent structure for token swaps
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @param amountIn Amount of input tokens
     * @param maxSlippageBps Maximum allowed slippage in basis points
     * @param deadline Unix timestamp deadline for execution
     * @param chainId Chain ID where intent should be executed
     * @param receiver Address to receive output tokens
     * @param nonce Unique nonce to prevent replay attacks
     */
    struct Intent {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint16 maxSlippageBps;
        uint64 deadline;
        uint256 chainId;
        address receiver;
        uint256 nonce;
    }

    // ============ Bid Structures ============

    /**
     * @notice Solver bid for intent execution
     * @param solver Address of the solver
     * @param quoteOut Promised output amount
     * @param solverFeeBps Solver fee in basis points
     * @param calldataHint Router calldata or reference
     */
    struct BidLike {
        address solver;
        uint256 quoteOut;
        uint16 solverFeeBps;
        bytes calldataHint;
    }

    /**
     * @notice Extended bid with timing and validation info
     * @param intentHash Hash of the target intent
     * @param solver Address of the solver
     * @param quoteOut Promised output amount
     * @param solverFeeBps Solver fee in basis points
     * @param calldataHint Router calldata or reference
     * @param ttlMs Time-to-live in milliseconds
     * @param timestamp When the bid was created
     */
    struct Bid {
        bytes32 intentHash;
        address solver;
        uint256 quoteOut;
        uint16 solverFeeBps;
        bytes calldataHint;
        uint32 ttlMs;
        uint64 timestamp;
    }

    // ============ Execution Structures ============

    /**
     * @notice Intent execution result
     * @param intentHash Hash of executed intent
     * @param solver Address of winning solver
     * @param amountOut Actual output amount received
     * @param solverFee Fee paid to solver
     * @param executedAt Block timestamp of execution
     * @param txHash Transaction hash
     */
    struct ExecutionResult {
        bytes32 intentHash;
        address solver;
        uint256 amountOut;
        uint256 solverFee;
        uint64 executedAt;
        bytes32 txHash;
    }

    // ============ Router Call Structures ============

    /**
     * @notice Router call parameters
     * @param target Router contract address
     * @param calldata Encoded function call
     * @param value ETH value to send (if any)
     */
    struct RouterCall {
        address target;
        bytes calldata;
        uint256 value;
    }

    // ============ Events ============

    /**
     * @notice Emitted when a new intent is created
     * @param intentHash Unique hash of the intent
     * @param creator Address who created the intent
     * @param intent The intent data
     */
    event IntentCreated(
        bytes32 indexed intentHash,
        address indexed creator,
        Intent intent
    );

    /**
     * @notice Emitted when a bid is submitted
     * @param intentHash Hash of target intent
     * @param solver Address of bidding solver
     * @param quoteOut Bid output amount
     * @param solverFeeBps Solver fee
     */
    event BidSubmitted(
        bytes32 indexed intentHash,
        address indexed solver,
        uint256 quoteOut,
        uint16 solverFeeBps
    );

    /**
     * @notice Emitted when a bid is selected as winner
     * @param intentHash Hash of target intent
     * @param solver Address of winning solver
     * @param quoteOut Winning bid amount
     */
    event BidSelected(
        bytes32 indexed intentHash,
        address indexed solver,
        uint256 quoteOut
    );

    // ============ Errors ============

    error InvalidBid();
    error BidExpired();
    error InsufficientQuote();
    error UnauthorizedSolver();
    error DuplicateBid();
}