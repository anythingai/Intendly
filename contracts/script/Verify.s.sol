// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IntentSettlement} from "../src/IntentSettlement.sol";

/**
 * @title Verify
 * @notice Script to verify deployed contracts on block explorers
 * @dev Run with: forge script script/Verify.s.sol --rpc-url <RPC_URL> --verify
 */
contract Verify is Script {
    
    function run() external {
        // Get contract address from deployment
        address settlementAddress = vm.envAddress("SETTLEMENT_CONTRACT_ADDRESS");
        
        // Get constructor arguments
        address permit2 = vm.envAddress("PERMIT2_ADDRESS");
        address router = vm.envAddress("ROUTER_ADDRESS");
        address feeTreasury = vm.envAddress("FEE_TREASURY");
        address owner = vm.envAddress("CONTRACT_OWNER");
        
        console.log("=== Contract Verification ===");
        console.log("Settlement Contract:", settlementAddress);
        console.log("Permit2:", permit2);
        console.log("Router:", router);
        console.log("Fee Treasury:", feeTreasury);
        console.log("Owner:", owner);
        
        // Verify constructor arguments match
        IntentSettlement settlement = IntentSettlement(settlementAddress);
        
        require(settlement.permit2() == permit2, "Permit2 address mismatch");
        require(settlement.router() == router, "Router address mismatch");
        require(settlement.feeTreasury() == feeTreasury, "Fee treasury mismatch");
        require(settlement.owner() == owner, "Owner mismatch");
        
        console.log("✅ All constructor arguments verified");
        console.log("✅ Contract verification complete");
        
        // Output verification command for manual use
        console.log("");
        console.log("Manual verification command:");
        console.log("forge verify-contract", settlementAddress, "src/IntentSettlement.sol:IntentSettlement");
        console.log(" --constructor-args", _encodeConstructorArgs(permit2, router, feeTreasury, owner));
        console.log(" --etherscan-api-key", "$ETHERSCAN_API_KEY");
        console.log(" --chain-id", vm.toString(block.chainid));
    }
    
    /**
     * @notice Encode constructor arguments for verification
     */
    function _encodeConstructorArgs(
        address permit2,
        address router,
        address feeTreasury,
        address owner
    ) internal pure returns (string memory) {
        return string(abi.encodePacked(
            "0x",
            _toHexString(abi.encode(permit2, router, feeTreasury, owner))
        ));
    }
    
    /**
     * @notice Convert bytes to hex string
     */
    function _toHexString(bytes memory data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < data.length; i++) {
            str[2 + i * 2] = alphabet[uint8(data[i] >> 4)];
            str[2 + 1 + i * 2] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }
}