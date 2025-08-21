// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IIntentSettlement} from "../interfaces/IIntentSettlement.sol";

/**
 * @title IntentHashLib
 * @notice Library for handling EIP-712 intent hashing and signature verification
 * @dev Implements EIP-712 typed data hashing for intent structures
 */
library IntentHashLib {
    // ============ Constants ============

    /// @notice EIP-712 type hash for Intent struct
    bytes32 private constant INTENT_TYPEHASH =
        keccak256(
            "Intent(address tokenIn,address tokenOut,uint256 amountIn,uint16 maxSlippageBps,uint64 deadline,uint256 chainId,address receiver,uint256 nonce)"
        );

    /// @notice EIP-712 domain type hash
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    // ============ Functions ============

    /**
     * @notice Calculate the domain separator for EIP-712
     * @param name Contract name for EIP-712
     * @param version Contract version for EIP-712
     * @param chainId Chain ID for EIP-712
     * @param verifyingContract Address of the verifying contract
     * @return bytes32 Domain separator hash
     */
    function calculateDomainSeparator(
        string memory name,
        string memory version,
        uint256 chainId,
        address verifyingContract
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifyingContract
            )
        );
    }

    /**
     * @notice Hash an intent struct according to EIP-712
     * @param intent The intent to hash
     * @return bytes32 Typed data hash of the intent
     */
    function hashIntent(IIntentSettlement.Intent memory intent) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
                intent.maxSlippageBps,
                intent.deadline,
                intent.chainId,
                intent.receiver,
                intent.nonce
            )
        );
    }

    /**
     * @notice Generate EIP-712 digest for intent signing
     * @param domainSeparator Domain separator for this contract
     * @param intent The intent to hash
     * @return bytes32 EIP-712 digest ready for signature
     */
    function getIntentDigest(
        bytes32 domainSeparator,
        IIntentSettlement.Intent memory intent
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator,
                hashIntent(intent)
            )
        );
    }

    /**
     * @notice Recover signer address from intent signature
     * @param domainSeparator Domain separator for this contract
     * @param intent The signed intent
     * @param signature The signature to verify
     * @return address The recovered signer address
     */
    function recoverIntentSigner(
        bytes32 domainSeparator,
        IIntentSettlement.Intent memory intent,
        bytes memory signature
    ) internal pure returns (address) {
        bytes32 digest = getIntentDigest(domainSeparator, intent);
        return recoverSigner(digest, signature);
    }

    /**
     * @notice Recover signer from digest and signature
     * @param digest EIP-712 digest
     * @param signature Signature bytes
     * @return address Recovered signer address
     */
    function recoverSigner(bytes32 digest, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "IntentHashLib: invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        
        return ecrecover(digest, v, r, s);
    }

    /**
     * @notice Verify intent signature
     * @param domainSeparator Domain separator for this contract
     * @param intent The signed intent
     * @param signature The signature to verify
     * @param expectedSigner Expected signer address
     * @return bool True if signature is valid
     */
    function verifyIntentSignature(
        bytes32 domainSeparator,
        IIntentSettlement.Intent memory intent,
        bytes memory signature,
        address expectedSigner
    ) internal pure returns (bool) {
        address recoveredSigner = recoverIntentSigner(domainSeparator, intent, signature);
        return recoveredSigner == expectedSigner && recoveredSigner != address(0);
    }
}