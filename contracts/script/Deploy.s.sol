// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IntentSettlement} from "../src/IntentSettlement.sol";

/**
 * @title Deploy
 * @notice Deployment script for IntentSettlement contract
 * @dev Run with: forge script script/Deploy.s.sol --rpc-url <RPC_URL> --broadcast
 */
contract Deploy is Script {
    // ============ Constants ============
    
    // X Layer mainnet addresses
    address constant XLAYER_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant XLAYER_ROUTER = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45; // Uniswap V3 SwapRouter02
    
    // X Layer testnet addresses
    address constant XLAYER_TESTNET_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant XLAYER_TESTNET_ROUTER = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45; // Uniswap V3 SwapRouter02
    
    // Fallback router addresses for other networks
    address constant DEFAULT_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant DEFAULT_ROUTER = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;

    // ============ State Variables ============
    
    IntentSettlement public settlement;

    // ============ Functions ============

    function run() external {
        // Get deployment parameters from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address feeTreasury = vm.envOr("FEE_TREASURY", deployer);
        address owner = vm.envOr("CONTRACT_OWNER", deployer);
        
        // Determine which network we're deploying to
        uint256 chainId = block.chainid;
        (address permit2Addr, address routerAddr) = _getNetworkAddresses(chainId);
        
        console.log("=== IntentSettlement Deployment ===");
        console.log("Chain ID:", chainId);
        console.log("Deployer:", deployer);
        console.log("Permit2:", permit2Addr);
        console.log("Router:", routerAddr);
        console.log("Fee Treasury:", feeTreasury);
        console.log("Owner:", owner);
        console.log("");

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy IntentSettlement contract
        settlement = new IntentSettlement(
            permit2Addr,
            routerAddr,
            feeTreasury,
            owner
        );

        vm.stopBroadcast();

        // Log deployment results
        console.log("=== Deployment Results ===");
        console.log("IntentSettlement deployed at:", address(settlement));
        console.log("Domain Separator:", vm.toString(settlement.DOMAIN_SEPARATOR()));
        console.log("Max Fee BPS:", settlement.maxFeeBps());
        console.log("");

        // Save deployment info to file
        _saveDeploymentInfo(chainId, address(settlement));
    }

    /**
     * @notice Get network-specific contract addresses
     * @param chainId Chain ID to get addresses for
     * @return permit2 Permit2 contract address
     * @return router Router contract address
     */
    function _getNetworkAddresses(uint256 chainId) internal pure returns (address permit2, address router) {
        if (chainId == 196) {
            // X Layer mainnet
            permit2 = XLAYER_PERMIT2;
            router = XLAYER_ROUTER;
        } else if (chainId == 195) {
            // X Layer testnet
            permit2 = XLAYER_TESTNET_PERMIT2;
            router = XLAYER_TESTNET_ROUTER;
        } else if (chainId == 1) {
            // Ethereum mainnet
            permit2 = DEFAULT_PERMIT2;
            router = DEFAULT_ROUTER;
        } else if (chainId == 137) {
            // Polygon
            permit2 = DEFAULT_PERMIT2;
            router = DEFAULT_ROUTER;
        } else if (chainId == 42161) {
            // Arbitrum One
            permit2 = DEFAULT_PERMIT2;
            router = DEFAULT_ROUTER;
        } else if (chainId == 8453) {
            // Base
            permit2 = DEFAULT_PERMIT2;
            router = DEFAULT_ROUTER;
        } else if (chainId == 31337) {
            // Hardhat/Anvil local network - use defaults
            permit2 = DEFAULT_PERMIT2;
            router = DEFAULT_ROUTER;
        } else {
            // Default to standard addresses for unknown chains
            permit2 = DEFAULT_PERMIT2;
            router = DEFAULT_ROUTER;
        }
        
        require(permit2 != address(0), "Permit2 address not set for this chain");
        require(router != address(0), "Router address not set for this chain");
    }

    /**
     * @notice Save deployment information to JSON file
     * @param chainId Chain ID
     * @param settlementAddr Deployed settlement contract address
     */
    function _saveDeploymentInfo(uint256 chainId, address settlementAddr) internal {
        string memory json = string.concat(
            '{\n',
            '  "chainId": ', vm.toString(chainId), ',\n',
            '  "contracts": {\n',
            '    "IntentSettlement": "', vm.toString(settlementAddr), '",\n',
            '    "Permit2": "', vm.toString(settlement.permit2()), '",\n',
            '    "Router": "', vm.toString(settlement.router()), '"\n',
            '  },\n',
            '  "deployedAt": ', vm.toString(block.timestamp), ',\n',
            '  "blockNumber": ', vm.toString(block.number), '\n',
            '}'
        );

        string memory filename = string.concat("deployments/", vm.toString(chainId), ".json");
        vm.writeFile(filename, json);
        console.log("Deployment info saved to:", filename);
    }
}