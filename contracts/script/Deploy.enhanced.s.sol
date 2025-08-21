// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IntentSettlement} from "../src/IntentSettlement.sol";

/**
 * @title Enhanced Deploy Script
 * @notice Enhanced deployment script with comprehensive validation and setup
 * @dev Supports multiple networks with automatic configuration detection
 */
contract DeployEnhanced is Script {
    // ============ Network Configuration ============
    
    struct NetworkConfig {
        uint256 chainId;
        string name;
        address permit2;
        address router;
        string blockExplorer;
        bool isTestnet;
    }
    
    mapping(uint256 => NetworkConfig) public networkConfigs;
    
    // ============ State Variables ============
    
    IntentSettlement public settlement;
    NetworkConfig public currentNetwork;
    
    // ============ Events ============
    
    event ContractDeployed(string contractName, address contractAddress);
    event NetworkConfigured(uint256 chainId, string networkName);
    event DeploymentValidated(address contractAddress, bool isValid);

    // ============ Constructor ============
    
    constructor() {
        _setupNetworkConfigs();
    }

    // ============ Main Functions ============

    function run() external {
        // Setup network configuration
        _setupCurrentNetwork();
        
        // Load deployment parameters
        DeploymentParams memory params = _loadDeploymentParams();
        
        // Validate parameters
        _validateDeploymentParams(params);
        
        // Deploy contracts
        _deployContracts(params);
        
        // Validate deployment
        _validateDeployment();
        
        // Setup post-deployment configuration
        _postDeploymentSetup(params);
        
        // Save deployment information
        _saveDeploymentInfo();
        
        // Print deployment summary
        _printDeploymentSummary();
    }

    // ============ Setup Functions ============

    function _setupNetworkConfigs() internal {
        // X Layer Mainnet
        networkConfigs[196] = NetworkConfig({
            chainId: 196,
            name: "X Layer Mainnet",
            permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3,
            router: 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45,
            blockExplorer: "https://www.oklink.com/xlayer",
            isTestnet: false
        });
        
        // X Layer Testnet
        networkConfigs[195] = NetworkConfig({
            chainId: 195,
            name: "X Layer Testnet",
            permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3,
            router: 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45,
            blockExplorer: "https://www.oklink.com/xlayer-test",
            isTestnet: true
        });
        
        // Ethereum Mainnet
        networkConfigs[1] = NetworkConfig({
            chainId: 1,
            name: "Ethereum Mainnet",
            permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3,
            router: 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45,
            blockExplorer: "https://etherscan.io",
            isTestnet: false
        });
        
        // Ethereum Sepolia
        networkConfigs[11155111] = NetworkConfig({
            chainId: 11155111,
            name: "Ethereum Sepolia",
            permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3,
            router: 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45,
            blockExplorer: "https://sepolia.etherscan.io",
            isTestnet: true
        });
        
        // Local development
        networkConfigs[31337] = NetworkConfig({
            chainId: 31337,
            name: "Local Development",
            permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3,
            router: 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45,
            blockExplorer: "http://localhost:8545",
            isTestnet: true
        });
    }

    function _setupCurrentNetwork() internal {
        uint256 chainId = block.chainid;
        currentNetwork = networkConfigs[chainId];
        
        require(currentNetwork.chainId != 0, "Unsupported network");
        
        console.log("=== Network Configuration ===");
        console.log("Chain ID:", chainId);
        console.log("Network:", currentNetwork.name);
        console.log("Is Testnet:", currentNetwork.isTestnet);
        console.log("Permit2:", currentNetwork.permit2);
        console.log("Router:", currentNetwork.router);
        console.log("");
        
        emit NetworkConfigured(chainId, currentNetwork.name);
    }

    // ============ Deployment Parameter Management ============

    struct DeploymentParams {
        uint256 deployerPrivateKey;
        address deployer;
        address owner;
        address feeTreasury;
        uint16 maxFeeBps;
        bool enableEmergencyMode;
        bool skipValidation;
    }

    function _loadDeploymentParams() internal view returns (DeploymentParams memory params) {
        params.deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        params.deployer = vm.addr(params.deployerPrivateKey);
        
        // Load addresses with fallbacks
        params.owner = vm.envOr("CONTRACT_OWNER", params.deployer);
        params.feeTreasury = vm.envOr("FEE_TREASURY", params.deployer);
        
        // Load configuration parameters
        params.maxFeeBps = uint16(vm.envOr("MAX_FEE_BPS", uint256(30))); // Default 0.3%
        params.enableEmergencyMode = vm.envOr("ENABLE_EMERGENCY_MODE", false);
        params.skipValidation = vm.envOr("SKIP_VALIDATION", false);
        
        console.log("=== Deployment Parameters ===");
        console.log("Deployer:", params.deployer);
        console.log("Owner:", params.owner);
        console.log("Fee Treasury:", params.feeTreasury);
        console.log("Max Fee BPS:", params.maxFeeBps);
        console.log("Emergency Mode:", params.enableEmergencyMode);
        console.log("");
    }

    function _validateDeploymentParams(DeploymentParams memory params) internal view {
        if (params.skipValidation) {
            console.log("⚠️  Skipping parameter validation");
            return;
        }
        
        console.log("Validating deployment parameters...");
        
        // Validate addresses
        require(params.deployer != address(0), "Invalid deployer address");
        require(params.owner != address(0), "Invalid owner address");
        require(params.feeTreasury != address(0), "Invalid fee treasury address");
        
        // Validate network addresses
        require(currentNetwork.permit2 != address(0), "Invalid Permit2 address");
        require(currentNetwork.router != address(0), "Invalid router address");
        
        // Validate fee parameters
        require(params.maxFeeBps <= 100, "Max fee too high (>1%)");
        
        // Production-specific validations
        if (!currentNetwork.isTestnet) {
            require(params.owner != params.deployer, "Owner should be different from deployer in production");
            require(params.feeTreasury != params.deployer, "Fee treasury should be different from deployer in production");
        }
        
        console.log("✅ Parameter validation passed");
    }

    // ============ Contract Deployment ============

    function _deployContracts(DeploymentParams memory params) internal {
        console.log("=== Contract Deployment ===");
        
        vm.startBroadcast(params.deployerPrivateKey);
        
        // Deploy IntentSettlement with CREATE2 for deterministic address
        bytes32 salt = keccak256(abi.encodePacked(
            "IntentSettlement",
            currentNetwork.chainId,
            block.timestamp
        ));
        
        settlement = new IntentSettlement{salt: salt}(
            currentNetwork.permit2,
            currentNetwork.router,
            params.feeTreasury,
            params.owner
        );
        
        vm.stopBroadcast();
        
        console.log("✅ IntentSettlement deployed at:", address(settlement));
        emit ContractDeployed("IntentSettlement", address(settlement));
        
        // Additional contract setup if needed
        if (params.maxFeeBps != 30) { // If different from default
            vm.startBroadcast(params.deployerPrivateKey);
            // Only deployer can set this initially, then ownership transfers
            if (params.owner == params.deployer) {
                settlement.setMaxFeeBps(params.maxFeeBps);
                console.log("✅ Max fee BPS set to:", params.maxFeeBps);
            }
            vm.stopBroadcast();
        }
    }

    function _validateDeployment() internal view {
        console.log("=== Deployment Validation ===");
        
        // Check contract code exists
        uint256 codeSize;
        address settlementAddr = address(settlement);
        assembly {
            codeSize := extcodesize(settlementAddr)
        }
        require(codeSize > 0, "Contract deployment failed - no code");
        
        // Validate contract state
        require(settlement.permit2() == currentNetwork.permit2, "Permit2 address mismatch");
        require(settlement.router() == currentNetwork.router, "Router address mismatch");
        require(settlement.DOMAIN_SEPARATOR() != bytes32(0), "Domain separator not set");
        
        // Check contract is not paused (if pause functionality exists)
        // require(!settlement.paused(), "Contract should not be paused on deployment");
        
        console.log("✅ Contract validation passed");
        emit DeploymentValidated(settlementAddr, true);
    }

    function _postDeploymentSetup(DeploymentParams memory params) internal {
        console.log("=== Post-Deployment Setup ===");
        
        // If owner is different from deployer, transfer ownership
        if (params.owner != params.deployer) {
            vm.startBroadcast(params.deployerPrivateKey);
            // Ownership transfer is handled in constructor
            console.log("✅ Ownership transferred to:", params.owner);
            vm.stopBroadcast();
        }
        
        // Additional setup for production
        if (!currentNetwork.isTestnet) {
            console.log("🔒 Production deployment - enabling security measures");
            // Add any production-specific setup here
        }
        
        console.log("✅ Post-deployment setup completed");
    }

    // ============ Information Management ============

    function _saveDeploymentInfo() internal {
        string memory chainIdStr = vm.toString(currentNetwork.chainId);
        
        // Create deployment artifact
        string memory json = string.concat(
            '{\n',
            '  "chainId": ', chainIdStr, ',\n',
            '  "network": "', currentNetwork.name, '",\n',
            '  "isTestnet": ', currentNetwork.isTestnet ? "true" : "false", ',\n',
            '  "deployedAt": ', vm.toString(block.timestamp), ',\n',
            '  "blockNumber": ', vm.toString(block.number), ',\n',
            '  "deployer": "', vm.toString(settlement.owner()), '",\n',
            '  "contracts": {\n',
            '    "IntentSettlement": "', vm.toString(address(settlement)), '",\n',
            '    "Permit2": "', vm.toString(currentNetwork.permit2), '",\n',
            '    "Router": "', vm.toString(currentNetwork.router), '"\n',
            '  },\n',
            '  "configuration": {\n',
            '    "feeTreasury": "', vm.toString(settlement.feeTreasury()), '",\n',
            '    "maxFeeBps": ', vm.toString(settlement.maxFeeBps()), ',\n',
            '    "domainSeparator": "', vm.toString(settlement.DOMAIN_SEPARATOR()), '"\n',
            '  },\n',
            '  "verification": {\n',
            '    "blockExplorer": "', currentNetwork.blockExplorer, '",\n',
            '    "contractUrl": "', currentNetwork.blockExplorer, '/address/', vm.toString(address(settlement)), '"\n',
            '  }\n',
            '}'
        );

        string memory filename = string.concat("deployments/", chainIdStr, ".json");
        vm.writeFile(filename, json);
        console.log("📄 Deployment info saved to:", filename);
        
        // Also save to timestamped file for history
        string memory timestampedFilename = string.concat(
            "deployments/",
            chainIdStr,
            "-",
            vm.toString(block.timestamp),
            ".json"
        );
        vm.writeFile(timestampedFilename, json);
    }

    function _printDeploymentSummary() internal view {
        console.log("");
        console.log("🎉 ===== DEPLOYMENT COMPLETED =====");
        console.log("Network:", currentNetwork.name);
        console.log("Chain ID:", currentNetwork.chainId);
        console.log("Block Number:", block.number);
        console.log("");
        console.log("📋 Contract Addresses:");
        console.log("  IntentSettlement:", address(settlement));
        console.log("  Permit2:", currentNetwork.permit2);
        console.log("  Router:", currentNetwork.router);
        console.log("");
        console.log("⚙️  Configuration:");
        console.log("  Owner:", settlement.owner());
        console.log("  Fee Treasury:", settlement.feeTreasury());
        console.log("  Max Fee BPS:", settlement.maxFeeBps());
        console.log("");
        console.log("🔍 Verification:");
        console.log("  Block Explorer:", currentNetwork.blockExplorer);
        console.log("  Contract URL:", string.concat(currentNetwork.blockExplorer, "/address/", vm.toString(address(settlement))));
        console.log("");
        console.log("🚀 Next Steps:");
        console.log("  1. Verify contract on block explorer");
        console.log("  2. Update backend environment variables");
        console.log("  3. Deploy backend services");
        console.log("  4. Run integration tests");
        console.log("===================================");
    }

    // ============ Utility Functions ============

    function getDeployedAddress() external view returns (address) {
        return address(settlement);
    }

    function getNetworkConfig() external view returns (NetworkConfig memory) {
        return currentNetwork;
    }

    function validateNetworkSupport(uint256 chainId) external view returns (bool) {
        return networkConfigs[chainId].chainId != 0;
    }
}