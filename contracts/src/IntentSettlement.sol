// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IIntentSettlement} from "./interfaces/IIntentSettlement.sol";
import {IPermit2} from "./interfaces/IPermit2.sol";
import {IRouter} from "./interfaces/IRouter.sol";
import {IntentHashLib} from "./libraries/IntentHashLib.sol";

/**
 * @title IntentSettlement
 * @notice Core settlement contract for intent-based trading
 * @dev Handles intent settlement with EIP-712 signatures and Permit2 integration
 */
contract IntentSettlement is IIntentSettlement, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using IntentHashLib for Intent;

    // ============ Constants ============

    /// @notice EIP-712 domain name
    string private constant DOMAIN_NAME = "IntentSwap";
    
    /// @notice EIP-712 domain version
    string private constant DOMAIN_VERSION = "1";

    /// @notice Maximum solver fee in basis points (30 bps = 0.3%)
    uint16 private constant MAX_SOLVER_FEE_BPS = 30;

    // ============ Immutable Variables ============

    /// @notice Permit2 contract for token transfers
    address public immutable permit2;
    
    /// @notice Router contract for DEX interactions
    address public immutable router;
    
    /// @notice EIP-712 domain separator
    bytes32 public immutable DOMAIN_SEPARATOR;

    // ============ State Variables ============

    /// @notice Mapping to track used nonces per user
    mapping(address => mapping(uint256 => bool)) public usedNonces;
    
    /// @notice Fee treasury address
    address public feeTreasury;
    
    /// @notice Maximum fee in basis points
    uint16 public maxFeeBps;

    // ============ Constructor ============

    /**
     * @notice Initialize the settlement contract
     * @param _permit2 Permit2 contract address
     * @param _router Router contract address
     * @param _feeTreasury Initial fee treasury address
     * @param _owner Contract owner address
     */
    constructor(
        address _permit2,
        address _router,
        address _feeTreasury,
        address _owner
    ) {
        require(_permit2 != address(0), "Invalid Permit2 address");
        require(_router != address(0), "Invalid router address");
        require(_feeTreasury != address(0), "Invalid treasury address");
        require(_owner != address(0), "Invalid owner address");

        permit2 = _permit2;
        router = _router;
        feeTreasury = _feeTreasury;
        maxFeeBps = MAX_SOLVER_FEE_BPS;

        DOMAIN_SEPARATOR = IntentHashLib.calculateDomainSeparator(
            DOMAIN_NAME,
            DOMAIN_VERSION,
            block.chainid,
            address(this)
        );

        _transferOwnership(_owner);
    }

    // ============ External Functions ============

    /**
     * @notice Submit and settle an intent with the winning bid
     * @param intent The intent to settle
     * @param userSig User's EIP-712 signature
     * @param selectedBid The selected winning bid
     * @param routerCalldata Calldata for router execution
     */
    function submitAndSettle(
        Intent calldata intent,
        bytes calldata userSig,
        BidLike calldata selectedBid,
        bytes calldata routerCalldata
    ) external nonReentrant {
        // Validate intent
        _validateIntent(intent);
        
        // Verify user signature
        _verifyUserSignature(intent, userSig);
        
        // Validate bid
        _validateBid(selectedBid);
        
        // Mark nonce as used
        usedNonces[intent.receiver][intent.nonce] = true;
        
        // Calculate minimum output based on slippage
        uint256 minAmountOut = _calculateMinAmountOut(intent.amountIn, intent.maxSlippageBps);
        
        // Pull tokens from user via Permit2
        _pullTokensViaPermit2(intent, userSig);
        
        // Execute router call and get actual output
        uint256 actualAmountOut = _executeRouterCall(intent, routerCalldata, minAmountOut);
        
        // Ensure we got at least the quoted amount
        require(actualAmountOut >= selectedBid.quoteOut, "Insufficient output");
        
        // Calculate and distribute fees
        uint256 solverFee = (actualAmountOut * selectedBid.solverFeeBps) / 10000;
        uint256 userAmount = actualAmountOut - solverFee;
        
        // Transfer tokens to user and solver
        address tokenOut = intent.tokenOut;
        if (solverFee > 0) {
            IERC20(tokenOut).safeTransfer(selectedBid.solver, solverFee);
            emit SolverPaid(selectedBid.solver, tokenOut, solverFee);
        }
        IERC20(tokenOut).safeTransfer(intent.receiver, userAmount);
        
        // Emit event
        bytes32 intentHash = IntentHashLib.hashIntent(intent);
        emit IntentFilled(
            intentHash,
            intent.receiver,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            actualAmountOut,
            selectedBid.solver,
            solverFee
        );
    }

    /**
     * @notice Check if a nonce has been used by a user
     * @param user User address
     * @param nonce Nonce to check
     * @return bool True if nonce has been used
     */
    function isNonceUsed(address user, uint256 nonce) external view returns (bool) {
        return usedNonces[user][nonce];
    }

    // ============ Owner Functions ============

    /**
     * @notice Update fee treasury address
     * @param _feeTreasury New fee treasury address
     */
    function setFeeTreasury(address _feeTreasury) external onlyOwner {
        require(_feeTreasury != address(0), "Invalid treasury address");
        address oldTreasury = feeTreasury;
        feeTreasury = _feeTreasury;
        emit ParameterUpdated("feeTreasury", uint256(uint160(oldTreasury)), uint256(uint160(_feeTreasury)));
    }

    /**
     * @notice Update maximum fee in basis points
     * @param _maxFeeBps New maximum fee in basis points
     */
    function setMaxFeeBps(uint16 _maxFeeBps) external onlyOwner {
        require(_maxFeeBps <= 100, "Fee too high"); // Max 1%
        uint16 oldFee = maxFeeBps;
        maxFeeBps = _maxFeeBps;
        emit ParameterUpdated("maxFeeBps", oldFee, _maxFeeBps);
    }

    // ============ Internal Functions ============

    /**
     * @notice Validate intent parameters
     * @param intent Intent to validate
     */
    function _validateIntent(Intent calldata intent) internal view {
        require(intent.tokenIn != address(0), "Invalid tokenIn");
        require(intent.tokenOut != address(0), "Invalid tokenOut");
        require(intent.tokenIn != intent.tokenOut, "Same token");
        require(intent.amountIn > 0, "Invalid amountIn");
        require(intent.maxSlippageBps <= 500, "Slippage too high"); // Max 5%
        require(intent.deadline >= block.timestamp, "Intent expired");
        require(intent.chainId == block.chainid, "Wrong chain");
        require(intent.receiver != address(0), "Invalid receiver");
        require(!usedNonces[intent.receiver][intent.nonce], "Nonce already used");
    }

    /**
     * @notice Verify user's EIP-712 signature
     * @param intent Intent that was signed
     * @param signature User's signature
     */
    function _verifyUserSignature(Intent calldata intent, bytes calldata signature) internal view {
        bool isValid = IntentHashLib.verifyIntentSignature(
            DOMAIN_SEPARATOR,
            intent,
            signature,
            intent.receiver
        );
        require(isValid, "Invalid signature");
    }

    /**
     * @notice Validate bid parameters
     * @param bid Bid to validate
     */
    function _validateBid(BidLike calldata bid) internal view {
        require(bid.solver != address(0), "Invalid solver");
        require(bid.quoteOut > 0, "Invalid quote");
        require(bid.solverFeeBps <= maxFeeBps, "Fee too high");
    }

    /**
     * @notice Calculate minimum amount out based on slippage
     * @param amountIn Input amount
     * @param slippageBps Slippage in basis points
     * @return uint256 Minimum amount out
     */
    function _calculateMinAmountOut(uint256 amountIn, uint16 slippageBps) internal pure returns (uint256) {
        return (amountIn * (10000 - slippageBps)) / 10000;
    }

    /**
     * @notice Pull tokens from user via Permit2
     * @param intent Intent containing token and amount info
     * @param signature Combined intent + permit signature
     */
    function _pullTokensViaPermit2(Intent calldata intent, bytes calldata signature) internal {
        // Create permit for Permit2
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({
                token: intent.tokenIn,
                amount: intent.amountIn
            }),
            nonce: intent.nonce,
            deadline: intent.deadline
        });

        // Create transfer details
        IPermit2.SignatureTransferDetails memory transferDetails = IPermit2.SignatureTransferDetails({
            to: address(this),
            requestedAmount: intent.amountIn
        });

        // Execute permit transfer - this pulls tokens from user to this contract
        IPermit2(permit2).permitTransferFrom(
            permit,
            transferDetails,
            intent.receiver, // owner of tokens
            signature
        );
    }

    /**
     * @notice Execute router call and return output amount
     * @param intent Intent being executed
     * @param routerCalldata Calldata to execute on router
     * @param minAmountOut Minimum expected output
     * @return uint256 Actual output amount
     */
    function _executeRouterCall(
        Intent calldata intent,
        bytes calldata routerCalldata,
        uint256 minAmountOut
    ) internal returns (uint256) {
        // Approve router to spend input tokens
        IERC20(intent.tokenIn).safeApprove(router, intent.amountIn);
        
        // Get balance before router call
        uint256 balanceBefore = IERC20(intent.tokenOut).balanceOf(address(this));
        
        // Execute the router call
        (bool success, bytes memory returnData) = router.call(routerCalldata);
        
        if (!success) {
            // Reset approval
            IERC20(intent.tokenIn).safeApprove(router, 0);
            
            // Get revert reason
            string memory reason = _getRevertReason(returnData);
            emit RouterFailure(IntentHashLib.hashIntent(intent), returnData);
            revert(string(abi.encodePacked("Router call failed: ", reason)));
        }
        
        // Reset approval for security
        IERC20(intent.tokenIn).safeApprove(router, 0);
        
        // Calculate actual output by balance difference
        uint256 balanceAfter = IERC20(intent.tokenOut).balanceOf(address(this));
        uint256 actualAmountOut = balanceAfter - balanceBefore;
        
        // Ensure minimum output is met
        require(actualAmountOut >= minAmountOut, "Slippage exceeded");
        
        return actualAmountOut;
    }

    /**
     * @notice Extract revert reason from return data
     * @param returnData Return data from failed call
     * @return reason Revert reason string
     */
    function _getRevertReason(bytes memory returnData) internal pure returns (string memory reason) {
        if (returnData.length < 68) return "Unknown error";
        
        assembly {
            returnData := add(returnData, 0x04)
        }
        return abi.decode(returnData, (string));
    }
}