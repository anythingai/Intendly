// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/ERC20Mock.sol";

import {IntentSettlement} from "../src/IntentSettlement.sol";
import {IIntentSettlement} from "../src/interfaces/IIntentSettlement.sol";
import {IntentHashLib} from "../src/libraries/IntentHashLib.sol";
import {Permit2Mock} from "./mocks/Permit2Mock.sol";
import {RouterMock} from "./mocks/RouterMock.sol";

/**
 * @title IntentSettlementSecurityTest
 * @notice Security-focused tests for IntentSettlement contract
 * @dev Tests reentrancy, access control, and other security vectors
 */
contract IntentSettlementSecurityTest is Test {
    using IntentHashLib for IIntentSettlement.Intent;

    // ============ Test Contracts ============
    
    IntentSettlement public settlement;
    Permit2Mock public permit2Mock;
    RouterMock public routerMock;
    ERC20Mock public tokenA;
    ERC20Mock public tokenB;
    MaliciousRouter public maliciousRouter;
    ReentrantToken public reentrantToken;
    
    // ============ Test Addresses ============
    
    address public feeTreasury = makeAddr("feeTreasury");
    address public owner = makeAddr("owner");
    address public user = makeAddr("user");
    address public solver = makeAddr("solver");
    address public attacker = makeAddr("attacker");
    
    // ============ Test Constants ============
    
    uint256 public constant AMOUNT_IN = 1000 * 1e18;
    uint256 public constant AMOUNT_OUT = 990 * 1e18;
    uint16 public constant SLIPPAGE_BPS = 50;
    uint16 public constant SOLVER_FEE_BPS = 10;

    // ============ Setup ============

    function setUp() public {
        // Deploy mock tokens
        tokenA = new ERC20Mock();
        tokenB = new ERC20Mock();
        
        // Deploy mock contracts
        permit2Mock = new Permit2Mock();
        routerMock = new RouterMock();
        maliciousRouter = new MaliciousRouter();
        reentrantToken = new ReentrantToken();
        
        // Set exchange rate
        routerMock.setExchangeRate(address(tokenA), address(tokenB), 9900);
        
        // Deploy settlement contract
        vm.prank(owner);
        settlement = new IntentSettlement(
            address(permit2Mock),
            address(routerMock),
            feeTreasury,
            owner
        );
        
        // Setup balances and approvals
        tokenA.mint(user, AMOUNT_IN * 10);
        tokenB.mint(address(routerMock), AMOUNT_OUT * 10);
        reentrantToken.mint(user, AMOUNT_IN * 10);
        
        vm.startPrank(user);
        tokenA.approve(address(permit2Mock), type(uint256).max);
        reentrantToken.approve(address(permit2Mock), type(uint256).max);
        vm.stopPrank();
    }

    // ============ Reentrancy Tests ============

    function testReentrancyProtectionOnSubmitAndSettle() public {
        // Create intent with reentrant token
        IIntentSettlement.Intent memory intent = IIntentSettlement.Intent({
            tokenIn: address(reentrantToken),
            tokenOut: address(tokenB),
            amountIn: AMOUNT_IN,
            maxSlippageBps: SLIPPAGE_BPS,
            deadline: uint64(block.timestamp + 1 hours),
            chainId: block.chainid,
            receiver: user,
            nonce: 1
        });
        
        IIntentSettlement.BidLike memory bid = IIntentSettlement.BidLike({
            solver: solver,
            quoteOut: AMOUNT_OUT,
            solverFeeBps: SOLVER_FEE_BPS,
            calldataHint: abi.encode("test")
        });
        
        bytes memory userSig = _createMockSignature(intent);
        bytes memory routerCalldata = abi.encodeWithSelector(bytes4(0x12345678));
        
        // Set the reentrant token to attempt reentrancy
        reentrantToken.setReentrancyTarget(address(settlement));
        reentrantToken.setReentrancyCalldata(
            abi.encodeWithSelector(
                settlement.submitAndSettle.selector,
                intent,
                userSig,
                bid,
                routerCalldata
            )
        );
        
        // Should revert due to reentrancy guard
        vm.expectRevert("ReentrancyGuard: reentrant call");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
    }

    // ============ Access Control Tests ============

    function testOnlyOwnerCanSetFeeTreasury() public {
        address newTreasury = makeAddr("newTreasury");
        
        // Non-owner should fail
        vm.prank(attacker);
        vm.expectRevert("Ownable: caller is not the owner");
        settlement.setFeeTreasury(newTreasury);
        
        // Owner should succeed
        vm.prank(owner);
        settlement.setFeeTreasury(newTreasury);
        assertEq(settlement.feeTreasury(), newTreasury);
    }

    function testOnlyOwnerCanSetMaxFeeBps() public {
        uint16 newFee = 25;
        
        // Non-owner should fail
        vm.prank(attacker);
        vm.expectRevert("Ownable: caller is not the owner");
        settlement.setMaxFeeBps(newFee);
        
        // Owner should succeed
        vm.prank(owner);
        settlement.setMaxFeeBps(newFee);
        assertEq(settlement.maxFeeBps(), newFee);
    }

    // ============ Integer Overflow Tests ============

    function testNoIntegerOverflowInFeeCalculation() public {
        IIntentSettlement.Intent memory intent = _createValidIntent();
        
        // Create bid with maximum possible values
        IIntentSettlement.BidLike memory bid = IIntentSettlement.BidLike({
            solver: solver,
            quoteOut: type(uint256).max,
            solverFeeBps: 30, // Max allowed
            calldataHint: abi.encode("test")
        });
        
        bytes memory userSig = _createMockSignature(intent);
        bytes memory routerCalldata = _createRouterCalldata(intent);
        
        // Should handle large numbers without overflow
        vm.expectRevert("Insufficient output"); // Will fail on quote check, not overflow
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
    }

    // ============ Signature Validation Security Tests ============

    function testCannotReuseSignatureFromDifferentUser() public {
        // Create intent for user
        IIntentSettlement.Intent memory intent = _createValidIntent();
        intent.receiver = user;
        bytes memory userSig = _createMockSignature(intent);
        
        // Try to use same intent but change receiver to attacker
        intent.receiver = attacker;
        
        IIntentSettlement.BidLike memory bid = _createValidBid();
        bytes memory routerCalldata = _createRouterCalldata(intent);
        
        // Should fail signature verification
        vm.expectRevert("Invalid signature");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
    }

    function testCannotSubmitExpiredIntent() public {
        IIntentSettlement.Intent memory intent = _createValidIntent();
        intent.deadline = uint64(block.timestamp - 1); // Expired
        
        IIntentSettlement.BidLike memory bid = _createValidBid();
        bytes memory userSig = _createMockSignature(intent);
        bytes memory routerCalldata = _createRouterCalldata(intent);
        
        vm.expectRevert("Intent expired");
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
    }

    // ============ Router Security Tests ============

    function testMaliciousRouterCannotStealFunds() public {
        // Deploy settlement with malicious router
        vm.prank(owner);
        IntentSettlement maliciousSettlement = new IntentSettlement(
            address(permit2Mock),
            address(maliciousRouter),
            feeTreasury,
            owner
        );
        
        IIntentSettlement.Intent memory intent = _createValidIntent();
        IIntentSettlement.BidLike memory bid = _createValidBid();
        bytes memory userSig = _createMockSignature(intent);
        bytes memory routerCalldata = abi.encodeWithSelector(
            maliciousRouter.maliciousSwap.selector,
            address(tokenA),
            address(tokenB),
            AMOUNT_IN,
            attacker // Try to send tokens to attacker
        );
        
        uint256 attackerBalanceBefore = tokenB.balanceOf(attacker);
        
        // Even with malicious router, tokens should go to settlement contract first
        maliciousSettlement.submitAndSettle(intent, userSig, bid, routerCalldata);
        
        // Attacker should not have received any tokens directly
        assertEq(tokenB.balanceOf(attacker), attackerBalanceBefore);
    }

    // ============ Edge Case Tests ============

    function testZeroFeeHandling() public {
        IIntentSettlement.Intent memory intent = _createValidIntent();
        IIntentSettlement.BidLike memory bid = _createValidBid();
        bid.solverFeeBps = 0; // Zero fee
        
        bytes memory userSig = _createMockSignature(intent);
        bytes memory routerCalldata = _createRouterCalldata(intent);
        
        uint256 userBalanceBefore = tokenB.balanceOf(user);
        uint256 solverBalanceBefore = tokenB.balanceOf(solver);
        
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
        
        // Solver should not receive any fee
        assertEq(tokenB.balanceOf(solver), solverBalanceBefore);
        // User should receive all output tokens
        assertGt(tokenB.balanceOf(user), userBalanceBefore);
    }

    function testMaxSlippageEdgeCase() public {
        IIntentSettlement.Intent memory intent = _createValidIntent();
        intent.maxSlippageBps = 500; // Maximum allowed (5%)
        
        IIntentSettlement.BidLike memory bid = _createValidBid();
        bytes memory userSig = _createMockSignature(intent);
        bytes memory routerCalldata = _createRouterCalldata(intent);
        
        // Should work with maximum slippage
        settlement.submitAndSettle(intent, userSig, bid, routerCalldata);
    }

    // ============ Helper Functions ============

    function _createValidIntent() internal view returns (IIntentSettlement.Intent memory) {
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

    function _createValidBid() internal view returns (IIntentSettlement.BidLike memory) {
        return IIntentSettlement.BidLike({
            solver: solver,
            quoteOut: AMOUNT_OUT,
            solverFeeBps: SOLVER_FEE_BPS,
            calldataHint: abi.encode("test")
        });
    }

    function _createMockSignature(IIntentSettlement.Intent memory) internal pure returns (bytes memory) {
        return abi.encodePacked(
            bytes32(0x1234567890123456789012345678901234567890123456789012345678901234),
            bytes32(0x1234567890123456789012345678901234567890123456789012345678901234),
            uint8(27)
        );
    }

    function _createRouterCalldata(IIntentSettlement.Intent memory intent) internal view returns (bytes memory) {
        RouterMock.ExactInputSingleParams memory params = RouterMock.ExactInputSingleParams({
            tokenIn: intent.tokenIn,
            tokenOut: intent.tokenOut,
            fee: 3000,
            recipient: address(settlement),
            deadline: intent.deadline,
            amountIn: intent.amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        return abi.encodeWithSelector(RouterMock.exactInputSingle.selector, params);
    }
}

/**
 * @title MaliciousRouter
 * @notice Router that tries to steal funds or behave maliciously
 */
contract MaliciousRouter {
    function maliciousSwap(
        address tokenIn,
        address tokenOut, 
        uint256 amountIn,
        address recipient
    ) external {
        // Try to send tokens to malicious recipient
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(recipient, amountIn);
    }
}

/**
 * @title ReentrantToken
 * @notice ERC20 token that attempts reentrancy on transfer
 */
contract ReentrantToken is ERC20Mock {
    address public reentrancyTarget;
    bytes public reentrancyCalldata;
    bool public shouldReenter;

    function setReentrancyTarget(address target) external {
        reentrancyTarget = target;
    }

    function setReentrancyCalldata(bytes memory data) external {
        reentrancyCalldata = data;
        shouldReenter = true;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (shouldReenter && reentrancyTarget != address(0)) {
            shouldReenter = false; // Prevent infinite recursion
            (bool success,) = reentrancyTarget.call(reentrancyCalldata);
            require(!success, "Reentrancy should fail");
        }
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (shouldReenter && reentrancyTarget != address(0)) {
            shouldReenter = false; // Prevent infinite recursion
            (bool success,) = reentrancyTarget.call(reentrancyCalldata);
            require(!success, "Reentrancy should fail");
        }
        return super.transferFrom(from, to, amount);
    }
}