// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/ERC20Mock.sol";

import {IntentSettlement} from "../src/IntentSettlement.sol";
import {IIntentSettlement} from "../src/interfaces/IIntentSettlement.sol";
import {IPermit2} from "../src/interfaces/IPermit2.sol";
import {IntentHashLib} from "../src/libraries/IntentHashLib.sol";
import {Permit2Mock} from "./mocks/Permit2Mock.sol";
import {RouterMock} from "./mocks/RouterMock.sol";

/**
 * @title IntentSettlementTest
 * @notice Comprehensive test suite for IntentSettlement contract
 * @dev Tests all functionality including Permit2 integration, router calls, and edge cases
 */
contract IntentSettlementTest is Test {
    using IntentHashLib for IIntentSettlement.Intent;

    // ============ Test Contracts ============
    
    IntentSettlement public settlement;
    Permit2Mock public permit2Mock;
    RouterMock public routerMock;
    ERC20Mock public tokenA;
    ERC20Mock public tokenB;
    
    // ============ Test Addresses ============
    
    address public feeTreasury = makeAddr("feeTreasury");
    address public owner = makeAddr("owner");
    address public user = makeAddr("user");
    address public solver = makeAddr("solver");
    address public maliciousUser = makeAddr("maliciousUser");
    
    // ============ Test Constants ============
    
    uint256 public constant AMOUNT_IN = 1000 * 1e18;
    uint256 public constant AMOUNT_OUT = 990 * 1e18;
    uint16 public constant SLIPPAGE_BPS = 50; // 0.5%
    uint16 public constant SOLVER_FEE_BPS = 10; // 0.1%
    uint256 public constant EXCHANGE_RATE = 9900; // 0.99 rate (tokenA -> tokenB)

    // ============ Events for Testing ============
    
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
    
    event SolverPaid(address indexed solver, address token, uint256 amount);
    event RouterFailure(bytes32 indexed intentHash, bytes reason);

    // ============ Setup ============

    function setUp() public {
        // Deploy mock tokens
        tokenA = new ERC20Mock();
        tokenB = new ERC20Mock();
        
        // Deploy mock contracts
        permit2Mock = new Permit2Mock();
        routerMock = new RouterMock();
        
        // Set exchange rate on router mock
        routerMock.setExchangeRate(address(tokenA), address(tokenB), EXCHANGE_RATE);
        
        // Deploy settlement contract
        vm.prank(owner);
        settlement = new IntentSettlement(
            address(permit2Mock),
            address(routerMock),
            feeTreasury,
            owner
        );
        
        // Setup initial token balances
        tokenA.mint(user, AMOUNT_IN * 10);
        tokenB.mint(address(routerMock), AMOUNT_OUT * 10);
        
        // Setup user approvals for Permit2Mock
        vm.startPrank(user);
        tokenA.approve(address(permit2Mock), type(uint256).max);
        vm.stopPrank();
        
        // Setup solver balance for fees
        tokenB.mint(solver, 1000 * 1e18);
    }

    // ============ Constructor Tests ============

    function testConstructor() public {
        assertEq(settlement.permit2(), address(permit2Mock));
        assertEq(settlement.router(), address(routerMock));
        assertEq(settlement.feeTreasury(), feeTreasury);
        assertEq(settlement.owner(), owner);
        assertEq(settlement.maxFeeBps(), 30); // MAX_SOLVER_FEE_BPS
        assertTrue(settlement.DOMAIN_SEPARATOR() != bytes32(0));
    }

    function testConstructorInvalidAddresses() public {
        vm.expectRevert("Invalid Permit2 address");
        new IntentSettlement(address(0), address(routerMock), feeTreasury, owner);
        
        vm.expectRevert("Invalid router address");
        new IntentSettlement(address(permit2Mock), address(0), feeTreasury, owner);
        
        vm.expectRevert("Invalid treasury address");
        new IntentSettlement(address(permit2Mock), address(routerMock), address(0), owner);
        
        vm.expectRevert("Invalid owner address");
        new IntentSettlement(address(permit2Mock), address(routerMock), feeTreasury, address(0));
    }

    // ============ Core Functionality Tests ============

    function testSuccessfulIntentSettlement() public {
        // Create test intent and bid
        IIntentSettlement.Intent memory intent = _createTestIntent();
        IIntentSettlement.BidLike memory bid = _createTestBid();
        bytes memory userSig = _createMockSignature(intent);
        bytes memory routerCalldata = _createRouterCalldata(intent);
        
        // Record balances before
        uint256 userTokenABefore = tokenA.balanceOf(user);
        uint256 userTokenBBefore = tokenB.balanceOf(user);
        uint256 solverTokenBBefore = tokenB.balanceOf(solver);
        
        // Calculate expected amounts
        uint256 expectedAmountOut = (AMOUNT_IN * EXCHANGE_RATE) / 10000;
        expectedAmountOut = expectedAmountOut - (expectedAmountOut * routerMock.swapFeeBps()) / 10000;
        uint256 expectedSolverFee = (expectedAmountOut * SOLVER_FEE_BPS) / 10000;
        uint256 expectedUserAmount = expectedAmountOut - expectedSolverFee;
        
        // Expect events
        vm.expectEmit(true, true, false, true);
        emit SolverPaid(solver, address(tokenB), expectedSolverFee);
        
        vm.expectEmit(true, true, false, true);
        emit IntentFilled(
            IntentHashLib.hashIntent(intent),
            user,
            address(tokenA),
            address(tokenB),
            AMOUNT_IN,
            expectedAmountOut,
            solver,
            expectedSolverFee
        );
        
        // Execute settlement
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
        
        // Verify balances changed correctly
        assertEq(tokenA.balanceOf(user), userTokenABefore - AMOUNT_IN, "User tokenA balance incorrect");
        assertEq(tokenB.balanceOf(user), userTokenBBefore + expectedUserAmount, "User tokenB balance incorrect");
        assertEq(tokenB.balanceOf(solver), solverTokenBBefore + expectedSolverFee, "Solver fee incorrect");
        
        // Verify nonce is used
        assertTrue(settlement.isNonceUsed(user, 1), "Nonce should be marked as used");
    }

    function testIntentValidation() public {
        IIntentSettlement.Intent memory intent = _createTestIntent();
        IIntentSettlement.BidLike memory bid = _createTestBid();
        bytes memory userSig = _createMockSignature(intent);
        bytes memory routerCalldata = _createRouterCalldata(intent);
        
        // Test invalid tokenIn
        intent.tokenIn = address(0);
        vm.expectRevert("Invalid tokenIn");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
        intent.tokenIn = address(tokenA);
        
        // Test invalid tokenOut
        intent.tokenOut = address(0);
        vm.expectRevert("Invalid tokenOut");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
        intent.tokenOut = address(tokenB);
        
        // Test same token
        intent.tokenOut = address(tokenA);
        vm.expectRevert("Same token");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
        intent.tokenOut = address(tokenB);
        
        // Test zero amount
        intent.amountIn = 0;
        vm.expectRevert("Invalid amountIn");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
        intent.amountIn = AMOUNT_IN;
        
        // Test slippage too high
        intent.maxSlippageBps = 501; // > 5%
        vm.expectRevert("Slippage too high");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
        intent.maxSlippageBps = SLIPPAGE_BPS;
        
        // Test expired intent
        intent.deadline = uint64(block.timestamp - 1);
        vm.expectRevert("Intent expired");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
        intent.deadline = uint64(block.timestamp + 1 hours);
        
        // Test wrong chain
        intent.chainId = 999;
        vm.expectRevert("Wrong chain");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
        intent.chainId = block.chainid;
        
        // Test invalid receiver
        intent.receiver = address(0);
        vm.expectRevert("Invalid receiver");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
    }

    function testBidValidation() public {
        IIntentSettlement.Intent memory intent = _createTestIntent();
        IIntentSettlement.BidLike memory bid = _createTestBid();
        bytes memory userSig = _createMockSignature(intent);
        bytes memory routerCalldata = _createRouterCalldata(intent);
        
        // Test invalid solver
        bid.solver = address(0);
        vm.expectRevert("Invalid solver");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
        bid.solver = solver;
        
        // Test invalid quote
        bid.quoteOut = 0;
        vm.expectRevert("Invalid quote");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
        bid.quoteOut = AMOUNT_OUT;
        
        // Test fee too high
        bid.solverFeeBps = 31; // > maxFeeBps
        vm.expectRevert("Fee too high");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
    }

    function testSlippageProtection() public {
        IIntentSettlement.Intent memory intent = _createTestIntent();
        intent.maxSlippageBps = 1; // Very low slippage tolerance
        
        IIntentSettlement.BidLike memory bid = _createTestBid();
        bytes memory userSig = _createMockSignature(intent);
        bytes memory routerCalldata = _createRouterCalldata(intent);
        
        vm.expectRevert("Slippage exceeded");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
    }

    function testRouterFailureHandling() public {
        // Set router to fail
        routerMock.setShouldFail(true, "Test router failure");
        
        IIntentSettlement.Intent memory intent = _createTestIntent();
        IIntentSettlement.BidLike memory bid = _createTestBid();
        bytes memory userSig = _createMockSignature(intent);
        bytes memory routerCalldata = _createRouterCalldata(intent);
        
        // Expect RouterFailure event
        vm.expectEmit(true, false, false, false);
        emit RouterFailure(IntentHashLib.hashIntent(intent), bytes(""));
        
        vm.expectRevert();
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
    }

    function testNonceReplayProtection() public {
        IIntentSettlement.Intent memory intent = _createTestIntent();
        IIntentSettlement.BidLike memory bid = _createTestBid();
        bytes memory userSig = _createMockSignature(intent);
        bytes memory routerCalldata = _createRouterCalldata(intent);
        
        // First execution should succeed
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
        
        // Second execution with same nonce should fail
        vm.expectRevert("Nonce already used");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
    }

    function testInsufficientOutputRevert() public {
        IIntentSettlement.Intent memory intent = _createTestIntent();
        IIntentSettlement.BidLike memory bid = _createTestBid();
        
        // Set bid quote higher than what router will provide
        bid.quoteOut = AMOUNT_OUT * 2;
        
        bytes memory userSig = _createMockSignature(intent);
        bytes memory routerCalldata = _createRouterCalldata(intent);
        
        vm.expectRevert("Insufficient output");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
    }

    // ============ Owner Function Tests ============

    function testSetFeeTreasury() public {
        address newTreasury = makeAddr("newTreasury");
        
        vm.prank(owner);
        settlement.setFeeTreasury(newTreasury);
        
        assertEq(settlement.feeTreasury(), newTreasury);
    }

    function testSetFeeTreasuryUnauthorized() public {
        address newTreasury = makeAddr("newTreasury");
        
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        settlement.setFeeTreasury(newTreasury);
    }

    function testSetFeeTreasuryInvalidAddress() public {
        vm.prank(owner);
        vm.expectRevert("Invalid treasury address");
        settlement.setFeeTreasury(address(0));
    }

    function testSetMaxFeeBps() public {
        uint16 newFee = 50; // 0.5%
        
        vm.prank(owner);
        settlement.setMaxFeeBps(newFee);
        
        assertEq(settlement.maxFeeBps(), newFee);
    }

    function testSetMaxFeeBpsUnauthorized() public {
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        settlement.setMaxFeeBps(50);
    }

    function testSetMaxFeeBpsTooHigh() public {
        vm.prank(owner);
        vm.expectRevert("Fee too high");
        settlement.setMaxFeeBps(101); // > 1%
    }

    // ============ Gas Optimization Tests ============

    function testGasUsage() public {
        IIntentSettlement.Intent memory intent = _createTestIntent();
        IIntentSettlement.BidLike memory bid = _createTestBid();
        bytes memory userSig = _createMockSignature(intent);
        bytes memory routerCalldata = _createRouterCalldata(intent);
        
        uint256 gasBefore = gasleft();
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas used for submitAndSettle:", gasUsed);
        
        // Should be reasonable gas usage (adjust threshold as needed)
        assertLt(gasUsed, 200000, "Gas usage too high");
    }

    // ============ Helper Functions ============

    function _createTestIntent() internal view returns (IIntentSettlement.Intent memory) {
        return IIntentSettlement.Intent({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: AMOUNT_IN,
            maxSlippageBps: SLIPPAGE_BPS,
            deadline: uint64(block.timestamp + 1 hours),
            chainId: block.chainid,
            receiver: user,
            nonce: 1
        });
    }

    function _createTestBid() internal view returns (IIntentSettlement.BidLike memory) {
        return IIntentSettlement.BidLike({
            solver: solver,
            quoteOut: AMOUNT_OUT,
            solverFeeBps: SOLVER_FEE_BPS,
            calldataHint: abi.encode("test_calldata")
        });
    }

    function _createMockSignature(IIntentSettlement.Intent memory intent) internal pure returns (bytes memory) {
        // For testing purposes, return a mock signature
        // In real implementation, this would be a valid EIP-712 signature
        return abi.encodePacked(
            bytes32(0x1234567890123456789012345678901234567890123456789012345678901234),
            bytes32(0x1234567890123456789012345678901234567890123456789012345678901234),
            uint8(27)
        );
    }

    function _createRouterCalldata(IIntentSettlement.Intent memory intent) internal view returns (bytes memory) {
        // Create calldata for exactInputSingle
        RouterMock.ExactInputSingleParams memory params = RouterMock.ExactInputSingleParams({
            tokenIn: intent.tokenIn,
            tokenOut: intent.tokenOut,
            fee: 3000, // 0.3%
            recipient: address(settlement),
            deadline: intent.deadline,
            amountIn: intent.amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        return abi.encodeWithSelector(RouterMock.exactInputSingle.selector, params);
    }

    // ============ Fuzz Tests ============

    function testFuzzIntentAmounts(uint256 amountIn, uint16 slippageBps) public {
        // Bound inputs to reasonable ranges
        amountIn = bound(amountIn, 1e6, 1000e18); // 1 USDC to 1000 tokens
        slippageBps = uint16(bound(slippageBps, 1, 500)); // 0.01% to 5%
        
        // Setup tokens with the fuzzed amount
        tokenA.mint(user, amountIn);
        
        IIntentSettlement.Intent memory intent = _createTestIntent();
        intent.amountIn = amountIn;
        intent.maxSlippageBps = slippageBps;
        intent.nonce = 99; // Use different nonce to avoid conflicts
        
        IIntentSettlement.BidLike memory bid = _createTestBid();
        bid.quoteOut = (amountIn * EXCHANGE_RATE) / 10000; // Adjust quote to match input
        
        bytes memory userSig = _createMockSignature(intent);
        bytes memory routerCalldata = _createRouterCalldata(intent);
        
        // Should not revert with valid parameters
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
    }
}