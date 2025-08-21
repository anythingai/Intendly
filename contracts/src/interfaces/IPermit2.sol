// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPermit2
 * @notice Interface for Uniswap's Permit2 contract
 * @dev Simplified interface containing only the functions we need
 */
interface IPermit2 {
    // ============ Structs ============

    /**
     * @notice Token permissions for Permit2
     * @param token Address of the token
     * @param amount Amount allowed to be transferred
     */
    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    /**
     * @notice Permit batch structure for multiple tokens
     * @param permitted Array of token permissions
     * @param nonce Unique nonce for the permit
     * @param deadline Expiration timestamp for the permit
     */
    struct PermitBatch {
        TokenPermissions[] permitted;
        uint256 nonce;
        uint256 deadline;
    }

    /**
     * @notice Transfer details for batch transfers
     * @param to Recipient address
     * @param requestedAmount Amount to transfer
     */
    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount;
    }

    /**
     * @notice Permit single token structure
     * @param permitted Token permission
     * @param nonce Unique nonce for the permit
     * @param deadline Expiration timestamp for the permit
     */
    struct PermitSingle {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }

    /**
     * @notice Permit transfer from structure for witness transfers
     * @param permitted Token permission
     * @param nonce Unique nonce for the permit
     * @param deadline Expiration timestamp for the permit
     */
    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }

    // ============ Functions ============

    /**
     * @notice Transfer tokens using a signed permit
     * @param permit The permit data
     * @param transferDetails Transfer details
     * @param owner Owner of the tokens
     * @param signature Signature of the permit
     */
    function permitTransferFrom(
        PermitSingle memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;

    /**
     * @notice Transfer multiple tokens using a signed permit
     * @param permit The permit data for multiple tokens
     * @param transferDetails Array of transfer details
     * @param owner Owner of the tokens
     * @param signature Signature of the permit
     */
    function permitTransferFrom(
        PermitBatch memory permit,
        SignatureTransferDetails[] calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;

    /**
     * @notice Transfer tokens using permitTransferFrom with witness
     * @param permit The permit data
     * @param transferDetails Transfer details
     * @param owner Owner of the tokens
     * @param signature Signature of the permit
     */
    function permitTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;

    /**
     * @notice Get the domain separator for EIP-712 signing
     * @return bytes32 The domain separator
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /**
     * @notice Check if a nonce has been used
     * @param owner Token owner
     * @param nonce Nonce to check
     * @return bool True if nonce has been used
     */
    function nonceBitmap(address owner, uint256 nonce) external view returns (uint256);
}