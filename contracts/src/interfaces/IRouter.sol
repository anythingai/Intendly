// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IRouter
 * @notice Interface for DEX router contracts (e.g., Uniswap V3 Router)
 * @dev Generic interface for router contract interactions
 */
interface IRouter {
    // ============ Structs ============

    /**
     * @notice Parameters for exact input single swap
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @param fee Pool fee tier
     * @param recipient Address to receive output tokens
     * @param deadline Transaction deadline
     * @param amountIn Input token amount
     * @param amountOutMinimum Minimum output amount
     * @param sqrtPriceLimitX96 Price limit for the swap
     */
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    /**
     * @notice Parameters for exact input path swap
     * @param path Encoded swap path
     * @param recipient Address to receive output tokens
     * @param deadline Transaction deadline
     * @param amountIn Input token amount
     * @param amountOutMinimum Minimum output amount
     */
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    // ============ Functions ============

    /**
     * @notice Perform exact input single token swap
     * @param params Swap parameters
     * @return amountOut Amount of output tokens received
     */
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);

    /**
     * @notice Perform exact input multi-hop swap
     * @param params Swap parameters
     * @return amountOut Amount of output tokens received
     */
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);

    /**
     * @notice Unwrap WETH to ETH and transfer to recipient
     * @param amountMinimum Minimum amount to unwrap
     * @param recipient Address to receive ETH
     */
    function unwrapWETH9(uint256 amountMinimum, address recipient) external payable;

    /**
     * @notice Refund any ETH held by the contract to the caller
     */
    function refundETH() external payable;

    /**
     * @notice Multicall function to batch multiple operations
     * @param data Array of encoded function calls
     * @return results Array of return data from each call
     */
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results);
}