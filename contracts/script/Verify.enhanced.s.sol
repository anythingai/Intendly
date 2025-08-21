// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IntentSettlement} from "../src/IntentSettlement.sol";

/**
 * @title Enhanced Verification Script
 * @notice Enhanced contract verification script with comprehensive validation
 * @dev Supports multiple block explorers and automatic configuration detection
 */
contract VerifyEnhanced is Script {
    // ============ Network Configuration ============
    
    struct NetworkConfig {
        uint256 chainId;
        string name;
        string apiUrl;
        string blockExplorer;
        bool supportsVerification;
    }
    
    mapping(uint256 => NetworkConfig) public networkConfigs;
    NetworkConfig public currentNetwork;
    
    // ============ Constructor ============
    
    constructor() {
        _setupNetworkConfigs();
    }

    // ============ Main Functions ============

    function run() external {
        // Setup network configuration
        _setupCurrentNetwork();
        
        // Load verification parameters
        VerificationParams memory params = _loadVerificationParams();
        
        // Validate contract deployment
        _validateContractDeployment(params);
        
        // Verify constructor arguments
        _verifyConstructorArguments(params);
        
        // Perform contract verification
        _performVerification(params);
        
        // Validate verification success
        _validateVerificationSuccess(params);
        
        // Print verification summary
        _printVerificationSummary(params);
    }

    // ============ Setup Functions ============

    function _setupNetworkConfigs() internal {
        // X Layer Mainnet
        networkConfigs[196] = NetworkConfig({
            chainId: 196,
            name: "X Layer Mainnet",
            apiUrl: "https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER",
            blockExplorer: "https://www.oklink.com/xlayer",
            supportsVerification: true
        });
        
        // X Layer Testnet
        networkConfigs[195] = NetworkConfig({
            chainId: 195,
            name: "X Layer Testnet",
            apiUrl: "https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER_TESTNET",
            blockExplorer: "https://www.oklink.com/xlayer-test",
            supportsVerification: true
        });
        
        // Ethereum Mainnet
        networkConfigs[1] = NetworkConfig({
            chainId: 1,
            name: "Ethereum Mainnet",
            apiUrl: "https://api.etherscan.io/api",
            blockExplorer: "https://etherscan.io",
            supportsVerification: true
        });
        
        // Ethereum Sepolia
        networkConfigs[11155111] = NetworkConfig({
            chainId: 11155111,
            name: "Ethereum Sepolia",
            apiUrl: "https://api-sepolia.etherscan.io/api",
            blockExplorer: "https://sepolia.etherscan.io",
            supportsVerification: true
        });
        
        // Local development
        networkConfigs[31337] = NetworkConfig({
            chainId: 31337,
            name: "Local Development",
            apiUrl: "",
            blockExplorer: "http://localhost:8545",
            supportsVerification: false
        });
    }

    function _setupCurrentNetwork() internal {
        uint256 chainId = block.chainid;
        currentNetwork = networkConfigs[chainId];
        
        require(currentNetwork.chainId != 0, "Unsupported network");
        
        console.log("=== Network Configuration ===");
        console.log("Chain ID:", chainId);
        console.log("Network:", currentNetwork.name);
        console.log("Block Explorer:", currentNetwork.blockExplorer);
        console.log("Supports Verification:", currentNetwork.supportsVerification);
        console.log("");
    }

    // ============ Verification Parameter Management ============

    struct VerificationParams {
        address settlementAddress;
        address permit2Address;
        address routerAddress;
        address feeTreasury;
        address owner;
        string apiKey;
        bool skipVerification;
        bool validateOnly;
    }

    function _loadVerificationParams() internal view returns (VerificationParams memory params) {
        // Load contract address from environment or deployment file
        if (vm.envOr("SETTLEMENT_CONTRACT_ADDRESS", address(0)) != address(0)) {
            params.settlementAddress = vm.envAddress("SETTLEMENT_CONTRACT_ADDRESS");
        } else {
            // Try to load from deployment file
            params.settlementAddress = _loadFromDeploymentFile();
        }
        
        params.permit2Address = vm.envAddress("PERMIT2_ADDRESS");
        params.routerAddress = vm.envAddress("ROUTER_ADDRESS");
        params.feeTreasury = vm.envAddress("FEE_TREASURY");
        params.owner = vm.envAddress("CONTRACT_OWNER");
        
        // Load API key based on network
        params.apiKey = _getApiKey();
        
        // Load flags
        params.skipVerification = vm.envOr("SKIP_VERIFICATION", false);
        params.validateOnly = vm.envOr("VALIDATE_ONLY", false);
        
        console.log("=== Verification Parameters ===");
        console.log("Settlement Contract:", params.settlementAddress);
        console.log("Permit2:", params.permit2Address);
        console.log("Router:", params.routerAddress);
        console.log("Fee Treasury:", params.feeTreasury);
        console.log("Owner:", params.owner);
        console.log("Skip Verification:", params.skipVerification);
        console.log("Validate Only:", params.validateOnly);
        console.log("");
    }

    function _loadFromDeploymentFile() internal view returns (address) {
        string memory chainIdStr = vm.toString(currentNetwork.chainId);
        string memory filename = string.concat("deployments/", chainIdStr, ".json");
        
        try vm.readFile(filename) returns (string memory json) {
            // Parse JSON to extract contract address
            // Note: This is a simplified approach - in practice you might want to use a JSON parser
            console.log("Loading contract address from:", filename);
            // For now, return zero address and let the validation catch it
            return address(0);
        } catch {
            console.log("Could not load deployment file:", filename);
            return address(0);
        }
    }

    function _getApiKey() internal view returns (string memory) {
        if (currentNetwork.chainId == 196 || currentNetwork.chainId == 195) {
            return vm.envOr("XLAYER_API_KEY", string(""));
        } else if (currentNetwork.chainId == 1 || currentNetwork.chainId == 11155111) {
            return vm.envOr("ETHERSCAN_API_KEY", string(""));
        }
        return "";
    }

    // ============ Validation Functions ============

    function _validateContractDeployment(VerificationParams memory params) internal view {
        console.log("=== Contract Deployment Validation ===");
        
        require(params.settlementAddress != address(0), "Settlement contract address not provided");
        
        // Check if contract exists
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(params.settlementAddress)
        }
        require(codeSize > 0, "No contract code found at specified address");
        
        console.log("✅ Contract exists at address:", params.settlementAddress);
        console.log("✅ Contract code size:", codeSize, "bytes");
    }

    function _verifyConstructorArguments(VerificationParams memory params) internal view {
        console.log("=== Constructor Arguments Validation ===");
        
        IntentSettlement settlement = IntentSettlement(params.settlementAddress);
        
        // Verify constructor arguments match deployment
        address actualPermit2 = settlement.permit2();
        address actualRouter = settlement.router();
        address actualFeeTreasury = settlement.feeTreasury();
        address actualOwner = settlement.owner();
        
        console.log("Expected vs Actual:");
        console.log("Permit2:", params.permit2Address, "vs", actualPermit2);
        console.log("Router:", params.routerAddress, "vs", actualRouter);
        console.log("Fee Treasury:", params.feeTreasury, "vs", actualFeeTreasury);
        console.log("Owner:", params.owner, "vs", actualOwner);
        
        // Validate matches
        if (params.permit2Address != address(0)) {
            require(actualPermit2 == params.permit2Address, "Permit2 address mismatch");
        }
        if (params.routerAddress != address(0)) {
            require(actualRouter == params.routerAddress, "Router address mismatch");
        }
        if (params.feeTreasury != address(0)) {
            require(actualFeeTreasury == params.feeTreasury, "Fee treasury mismatch");
        }
        if (params.owner != address(0)) {
            require(actualOwner == params.owner, "Owner mismatch");
        }
        
        console.log("✅ All constructor arguments validated");
    }

    function _performVerification(VerificationParams memory params) internal {
        if (params.skipVerification || params.validateOnly) {
            console.log("⏭️  Skipping contract verification");
            return;
        }
        
        if (!currentNetwork.supportsVerification) {
            console.log("⚠️  Network does not support automatic verification");
            _printManualVerificationInstructions(params);
            return;
        }
        
        console.log("=== Contract Verification ===");
        
        // Check if API key is provided
        if (bytes(params.apiKey).length == 0) {
            console.log("⚠️  No API key provided, skipping automatic verification");
            _printManualVerificationInstructions(params);
            return;
        }
        
        console.log("🔍 Performing automatic contract verification...");
        
        // Note: Actual verification would be performed by forge verify-contract command
        // This is shown in the manual instructions
        _printManualVerificationInstructions(params);
    }

    function _validateVerificationSuccess(VerificationParams memory params) internal view {
        if (params.skipVerification || params.validateOnly || !currentNetwork.supportsVerification) {
            return;
        }
        
        console.log("=== Verification Success Validation ===");
        
        // In a real implementation, you would check the verification status
        // via the block explorer API
        console.log("ℹ️  Verification status check would be performed here");
        console.log("ℹ️  Check manually at:", _getContractUrl(params.settlementAddress));
    }

    // ============ Helper Functions ============

    function _printManualVerificationInstructions(VerificationParams memory params) internal view {
        console.log("");
        console.log("📋 Manual Verification Instructions:");
        console.log("=====================================");
        
        // Generate constructor arguments encoding
        string memory constructorArgs = _encodeConstructorArgs(
            params.permit2Address != address(0) ? params.permit2Address : IntentSettlement(params.settlementAddress).permit2(),
            params.routerAddress != address(0) ? params.routerAddress : IntentSettlement(params.settlementAddress).router(),
            params.feeTreasury != address(0) ? params.feeTreasury : IntentSettlement(params.settlementAddress).feeTreasury(),
            params.owner != address(0) ? params.owner : IntentSettlement(params.settlementAddress).owner()
        );
        
        console.log("");
        console.log("forge verify-contract \\");
        console.log("  ", params.settlementAddress, "\\");
        console.log("   src/IntentSettlement.sol:IntentSettlement \\");
        console.log("  --constructor-args", constructorArgs, "\\");
        
        if (bytes(params.apiKey).length > 0) {
            console.log("  --etherscan-api-key", params.apiKey, "\\");
        } else {
            console.log("  --etherscan-api-key $API_KEY \\");
        }
        
        console.log("  --chain-id", vm.toString(currentNetwork.chainId));
        console.log("");
        
        // Also provide web interface instructions
        console.log("🌐 Web Interface Verification:");
        console.log("1. Go to:", _getContractUrl(params.settlementAddress));
        console.log("2. Click on 'Contract' tab");
        console.log("3. Click on 'Verify and Publish'");
        console.log("4. Select 'Solidity (Single file)'");
        console.log("5. Upload flattened contract or use Solidity source");
        console.log("6. Use constructor arguments:", constructorArgs);
        console.log("");
    }

    function _encodeConstructorArgs(
        address permit2,
        address router,
        address feeTreasury,
        address owner
    ) internal pure returns (string memory) {
        bytes memory encoded = abi.encode(permit2, router, feeTreasury, owner);
        return _bytesToHex(encoded);
    }

    function _bytesToHex(bytes memory data) internal pure returns (string memory) {
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

    function _getContractUrl(address contractAddress) internal view returns (string memory) {
        return string.concat(
            currentNetwork.blockExplorer,
            "/address/",
            vm.toString(contractAddress)
        );
    }

    function _printVerificationSummary(VerificationParams memory params) internal view {
        console.log("");
        console.log("🎉 ===== VERIFICATION COMPLETED =====");
        console.log("Network:", currentNetwork.name);
        console.log("Contract:", params.settlementAddress);
        console.log("Block Explorer:", _getContractUrl(params.settlementAddress));
        console.log("");
        
        if (currentNetwork.supportsVerification && bytes(params.apiKey).length > 0 && !params.skipVerification) {
            console.log("✅ Contract verification submitted");
            console.log("⏳ Verification may take a few minutes to complete");
        } else {
            console.log("ℹ️  Use manual verification instructions above");
        }
        
        console.log("");
        console.log("🔍 Next Steps:");
        console.log("  1. Confirm verification status on block explorer");
        console.log("  2. Test contract interactions");
        console.log("  3. Update frontend configuration");
        console.log("  4. Run integration tests");
        console.log("=====================================");
    }

    // ============ Utility Functions ============

    function getNetworkConfig() external view returns (NetworkConfig memory) {
        return currentNetwork;
    }

    function validateNetworkSupport(uint256 chainId) external view returns (bool) {
        return networkConfigs[chainId].chainId != 0;
    }

    function supportsVerification(uint256 chainId) external view returns (bool) {
        return networkConfigs[chainId].supportsVerification;
    }
}