// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPermit2} from "../../src/interfaces/IPermit2.sol";

/**
 * @title Permit2Mock
 * @notice Mock implementation of Permit2 for testing
 * @dev Simplified mock that validates basic structure and transfers tokens
 */
contract Permit2Mock is IPermit2 {
    using SafeERC20 for IERC20;

    // Domain separator for EIP-712
    bytes32 public constant DOMAIN_SEPARATOR = keccak256("Permit2Mock");
    
    // Mapping to track used nonces
    mapping(address => mapping(uint256 => bool)) public usedNonces;
    
    // Events for testing
    event PermitTransferred(address indexed owner, address indexed to, address token, uint256 amount);

    /**
     * @notice Mock implementation of permitTransferFrom (single)
     */
    function permitTransferFrom(
        PermitSingle memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external override {
        // Basic validation
        require(permit.deadline >= block.timestamp, "Permit expired");
        require(!usedNonces[owner][permit.nonce], "Nonce already used");
        require(transferDetails.requestedAmount <= permit.permitted.amount, "Amount exceeds permit");
        
        // Mark nonce as used
        usedNonces[owner][permit.nonce] = true;
        
        // Transfer tokens
        IERC20(permit.permitted.token).safeTransferFrom(
            owner,
            transferDetails.to,
            transferDetails.requestedAmount
        );
        
        emit PermitTransferred(owner, transferDetails.to, permit.permitted.token, transferDetails.requestedAmount);
    }

    /**
     * @notice Mock implementation of permitTransferFrom (batch)
     */
    function permitTransferFrom(
        PermitBatch memory permit,
        SignatureTransferDetails[] calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external override {
        require(permit.deadline >= block.timestamp, "Permit expired");
        require(!usedNonces[owner][permit.nonce], "Nonce already used");
        require(permit.permitted.length == transferDetails.length, "Length mismatch");
        
        // Mark nonce as used
        usedNonces[owner][permit.nonce] = true;
        
        // Transfer each token
        for (uint256 i = 0; i < permit.permitted.length; i++) {
            require(transferDetails[i].requestedAmount <= permit.permitted[i].amount, "Amount exceeds permit");
            
            IERC20(permit.permitted[i].token).safeTransferFrom(
                owner,
                transferDetails[i].to,
                transferDetails[i].requestedAmount
            );
            
            emit PermitTransferred(owner, transferDetails[i].to, permit.permitted[i].token, transferDetails[i].requestedAmount);
        }
    }

    /**
     * @notice Mock implementation of permitTransferFrom with witness
     */
    function permitTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external override {
        // Basic validation
        require(permit.deadline >= block.timestamp, "Permit expired");
        require(!usedNonces[owner][permit.nonce], "Nonce already used");
        require(transferDetails.requestedAmount <= permit.permitted.amount, "Amount exceeds permit");
        
        // Mark nonce as used
        usedNonces[owner][permit.nonce] = true;
        
        // Transfer tokens
        IERC20(permit.permitted.token).safeTransferFrom(
            owner,
            transferDetails.to,
            transferDetails.requestedAmount
        );
        
        emit PermitTransferred(owner, transferDetails.to, permit.permitted.token, transferDetails.requestedAmount);
    }

    /**
     * @notice Check if nonce has been used
     */
    function nonceBitmap(address owner, uint256 nonce) external view override returns (uint256) {
        return usedNonces[owner][nonce] ? 1 : 0;
    }

    /**
     * @notice Helper function to set up approvals for testing
     */
    function setupApproval(address owner, address token, uint256 amount) external {
        // In real Permit2, this would be handled by the permit signature
        // For testing, we can pre-approve tokens
        IERC20(token).safeTransferFrom(owner, address(this), 0); // Check approval exists
    }
}