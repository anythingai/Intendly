// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IIntentSettlement
 * @notice Interface for the Intent-Based Trading Settlement Contract
 * @dev Defines the core structures and functions for intent-based trading
 */
interface IIntentSettlement {
    // ============ Structs ============

    /**
     * @notice Intent structure containing all parameters for a trade intent
     * @param tokenIn Address of the input token
     * @param tokenOut Address of the output token  
     * @param amountIn Amount of input tokens to trade
     * @param maxSlippageBps Maximum slippage in basis points (e.g., 50 = 0.5%)
     * @param deadline Unix timestamp after which the intent expires
     * @param chainId Chain ID where the intent should be executed
     * @param receiver Address that will receive the output tokens
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

    /**
     * @notice Bid structure containing solver's execution proposal
     * @param solver Address of the solver submitting the bid
     * @param quoteOut Minimum amount of output tokens guaranteed
     * @param solverFeeBps Solver fee in basis points
     * @param calldataHint Encoded calldata for router execution
     */
    struct BidLike {
        address solver;
        uint256 quoteOut;
        uint16 solverFeeBps;
        bytes calldataHint;
    }

    // ============ Events ============

    /**
     * @notice Emitted when an intent is successfully filled
     * @param intentHash Unique hash of the intent
     * @param user Address of the user who created the intent
     * @param tokenIn Address of the input token
     * @param tokenOut Address of the output token
     * @param amountIn Amount of input tokens traded
     * @param amountOut Amount of output tokens received
     * @param solver Address of the solver who filled the intent
     * @param fee Amount of tokens paid as solver fee
     */
    event IntentFilled(
        bytes32 indexed intentHash,
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address solver,
        uint256 fee
    );

    /**
     * @notice Emitted when contract parameters are updated
     * @param param Parameter name that was updated
     * @param oldValue Previous value
     * @param newValue New value
     */
    event ParameterUpdated(string param, uint256 oldValue, uint256 newValue);

    /**
     * @notice Emitted when solver is paid their fee
     * @param solver Address of the solver
     * @param token Token used for payment
     * @param amount Amount paid to solver
     */
    event SolverPaid(address indexed solver, address token, uint256 amount);

    /**
     * @notice Emitted when router call fails
     * @param intentHash Hash of the intent that failed
     * @param reason Failure reason data
     */
    event RouterFailure(bytes32 indexed intentHash, bytes reason);

    // ============ Errors ============

    error InvalidIntent();
    error IntentExpired();
    error InvalidSignature();
    error NonceAlreadyUsed();
    error SlippageExceeded();
    error InvalidSolver();
    error InvalidFee();
    error RouterCallFailed();
    error InsufficientOutput();
    error Unauthorized();

    // ============ Functions ============

    /**
     * @notice Submit and settle an intent with a winning bid
     * @param intent The intent to be settled
     * @param userSig EIP-712 signature of the intent by the user
     * @param selectedBid The winning bid selected by the coordinator
     * @param routerCalldata Calldata to execute on the router
     */
    function submitAndSettle(
        Intent calldata intent,
        bytes calldata userSig,
        BidLike calldata selectedBid,
        bytes calldata routerCalldata
    ) external;

    /**
     * @notice Check if a nonce has been used
     * @param user User address
     * @param nonce Nonce to check
     * @return bool True if nonce has been used
     */
    function isNonceUsed(address user, uint256 nonce) external view returns (bool);

    /**
     * @notice Get the domain separator for EIP-712 signing
     * @return bytes32 The domain separator
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /**
     * @notice Get the maximum allowed solver fee in basis points
     * @return uint16 Maximum fee in basis points
     */
    function maxFeeBps() external view returns (uint16);

    /**
     * @notice Get the Permit2 contract address
     * @return address Permit2 contract address
     */
    function permit2() external view returns (address);

    /**
     * @notice Get the router contract address
     * @return address Router contract address
     */
    function router() external view returns (address);

    /**
     * @notice Get the fee treasury address
     * @return address Fee treasury address
     */
    function feeTreasury() external view returns (address);
}