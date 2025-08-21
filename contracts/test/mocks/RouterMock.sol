// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IRouter} from "../../src/interfaces/IRouter.sol";

/**
 * @title RouterMock
 * @notice Mock DEX router for testing intent settlement
 * @dev Simulates token swaps with configurable exchange rates and failures
 */
contract RouterMock is IRouter {
    using SafeERC20 for IERC20;

    // Exchange rate in basis points (10000 = 1:1 ratio)
    mapping(address => mapping(address => uint256)) public exchangeRates;
    
    // Fee in basis points
    uint256 public swapFeeBps = 30; // 0.3% default
    
    // Toggle to simulate failures
    bool public shouldFail;
    string public failureReason = "RouterMock: Simulated failure";
    
    // Events
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    );
    
    event ExchangeRateSet(address indexed tokenIn, address indexed tokenOut, uint256 rate);

    /**
     * @notice Set exchange rate between two tokens
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param rate Exchange rate in basis points (10000 = 1:1)
     */
    function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external {
        exchangeRates[tokenIn][tokenOut] = rate;
        emit ExchangeRateSet(tokenIn, tokenOut, rate);
    }

    /**
     * @notice Set swap fee
     * @param _swapFeeBps Fee in basis points
     */
    function setSwapFee(uint256 _swapFeeBps) external {
        swapFeeBps = _swapFeeBps;
    }

    /**
     * @notice Toggle failure mode for testing
     * @param _shouldFail Whether to fail swaps
     * @param _reason Failure reason
     */
    function setShouldFail(bool _shouldFail, string memory _reason) external {
        shouldFail = _shouldFail;
        failureReason = _reason;
    }

    /**
     * @notice Mock exact input single swap
     */
    function exactInputSingle(ExactInputSingleParams calldata params) 
        external 
        payable 
        override 
        returns (uint256 amountOut) 
    {
        if (shouldFail) {
            revert(failureReason);
        }

        require(params.amountIn > 0, "RouterMock: Invalid amount");
        require(exchangeRates[params.tokenIn][params.tokenOut] > 0, "RouterMock: No exchange rate set");

        // Pull input tokens
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);

        // Calculate output amount with exchange rate and fee
        uint256 grossAmountOut = (params.amountIn * exchangeRates[params.tokenIn][params.tokenOut]) / 10000;
        uint256 fee = (grossAmountOut * swapFeeBps) / 10000;
        amountOut = grossAmountOut - fee;

        require(amountOut >= params.amountOutMinimum, "RouterMock: Insufficient output amount");

        // Transfer output tokens
        IERC20(params.tokenOut).safeTransfer(params.recipient, amountOut);

        emit SwapExecuted(params.tokenIn, params.tokenOut, params.amountIn, amountOut, params.recipient);
    }

    /**
     * @notice Mock exact input multi-hop swap
     */
    function exactInput(ExactInputParams calldata params) 
        external 
        payable 
        override 
        returns (uint256 amountOut) 
    {
        if (shouldFail) {
            revert(failureReason);
        }

        // For simplicity, just decode first and last token from path
        // Real implementation would handle multi-hop routing
        address tokenIn = _getFirstToken(params.path);
        address tokenOut = _getLastToken(params.path);
        
        require(params.amountIn > 0, "RouterMock: Invalid amount");
        require(exchangeRates[tokenIn][tokenOut] > 0, "RouterMock: No exchange rate set");

        // Pull input tokens
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);

        // Calculate output amount
        uint256 grossAmountOut = (params.amountIn * exchangeRates[tokenIn][tokenOut]) / 10000;
        uint256 fee = (grossAmountOut * swapFeeBps) / 10000;
        amountOut = grossAmountOut - fee;

        require(amountOut >= params.amountOutMinimum, "RouterMock: Insufficient output amount");

        // Transfer output tokens
        IERC20(tokenOut).safeTransfer(params.recipient, amountOut);

        emit SwapExecuted(tokenIn, tokenOut, params.amountIn, amountOut, params.recipient);
    }

    /**
     * @notice Mock WETH unwrap (no-op for testing)
     */
    function unwrapWETH9(uint256 amountMinimum, address recipient) external payable override {
        // No-op for testing purposes
    }

    /**
     * @notice Mock ETH refund (no-op for testing)
     */
    function refundETH() external payable override {
        // No-op for testing purposes
    }

    /**
     * @notice Mock multicall function
     */
    function multicall(bytes[] calldata data) external payable override returns (bytes[] memory results) {
        if (shouldFail) {
            revert(failureReason);
        }
        
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);
            require(success, "RouterMock: Multicall failed");
            results[i] = result;
        }
    }

    /**
     * @notice Mint tokens to this contract for testing
     */
    function mintTokensForSwap(address token, uint256 amount) external {
        // This would be called by test setup to provide liquidity
        // In real router, tokens come from liquidity pools
    }

    /**
     * @notice Emergency withdraw function for testing
     */
    function emergencyWithdraw(address token, uint256 amount, address to) external {
        IERC20(token).safeTransfer(to, amount);
    }

    // Helper functions to parse path (simplified for testing)
    function _getFirstToken(bytes memory path) internal pure returns (address) {
        require(path.length >= 20, "RouterMock: Invalid path");
        return address(bytes20(path[0:20]));
    }

    function _getLastToken(bytes memory path) internal pure returns (address) {
        require(path.length >= 20, "RouterMock: Invalid path");
        return address(bytes20(path[path.length-20:path.length]));
    }
}