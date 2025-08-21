#!/bin/bash

# Intent-Based Trading Aggregator - Smart Contract Deployment Script
# Usage: ./deploy-contracts.sh [environment] [verify]
# Example: ./deploy-contracts.sh production true

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTRACTS_DIR="${PROJECT_ROOT}/contracts"
DEPLOYMENT_DIR="${PROJECT_ROOT}/deployment"

# Default values
ENVIRONMENT="${1:-staging}"
VERIFY_CONTRACTS="${2:-false}"
DRY_RUN="${3:-false}"

# Supported environments
ENVIRONMENTS=(development staging production)

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Validation functions
validate_environment() {
    if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${ENVIRONMENT} " ]]; then
        log_error "Invalid environment: ${ENVIRONMENT}. Supported: ${ENVIRONMENTS[*]}"
    fi
}

check_prerequisites() {
    log_info "Checking deployment prerequisites..."
    
    # Check required tools
    local tools=("forge" "cast" "jq")
    
    for tool in "${tools[@]}"; do
        if ! command -v "${tool}" &> /dev/null; then
            log_error "${tool} is required but not installed"
        fi
    done
    
    # Check contracts directory
    if [[ ! -d "${CONTRACTS_DIR}" ]]; then
        log_error "Contracts directory not found: ${CONTRACTS_DIR}"
    fi
    
    # Check environment file
    local env_file="${DEPLOYMENT_DIR}/config/${ENVIRONMENT}.env"
    if [[ ! -f "${env_file}" ]]; then
        log_error "Environment file not found: ${env_file}"
    fi
    
    log_success "Prerequisites check passed"
}

load_environment() {
    log_info "Loading environment configuration for ${ENVIRONMENT}..."
    
    local env_file="${DEPLOYMENT_DIR}/config/${ENVIRONMENT}.env"
    
    # Export environment variables
    set -o allexport
    source "${env_file}"
    set +o allexport
    
    # Validate required environment variables
    local required_vars=(
        "CHAIN_ID"
        "RPC_URL"
        "DEPLOYER_PRIVATE_KEY"
        "CONTRACT_OWNER"
        "FEE_TREASURY"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable not set: ${var}"
        fi
    done
    
    log_success "Environment configuration loaded"
}

validate_network_connection() {
    log_info "Validating network connection..."
    
    # Test RPC connection
    local chain_id
    chain_id=$(cast chain-id --rpc-url "${RPC_URL}" 2>/dev/null || echo "")
    
    if [[ -z "${chain_id}" ]]; then
        log_error "Failed to connect to RPC: ${RPC_URL}"
    fi
    
    if [[ "${chain_id}" != "${CHAIN_ID}" ]]; then
        log_error "Chain ID mismatch. Expected: ${CHAIN_ID}, Got: ${chain_id}"
    fi
    
    # Check deployer balance
    local deployer_address
    deployer_address=$(cast wallet address --private-key "${DEPLOYER_PRIVATE_KEY}")
    
    local balance
    balance=$(cast balance "${deployer_address}" --rpc-url "${RPC_URL}")
    
    log_info "Deployer address: ${deployer_address}"
    log_info "Deployer balance: $(cast from-wei "${balance}") ETH"
    
    # Check minimum balance (0.01 ETH)
    local min_balance="10000000000000000" # 0.01 ETH in wei
    if [[ "${balance}" -lt "${min_balance}" ]]; then
        log_warning "Low deployer balance. Recommended: at least 0.01 ETH"
    fi
    
    log_success "Network validation passed"
}

build_contracts() {
    log_info "Building smart contracts..."
    
    cd "${CONTRACTS_DIR}"
    
    # Clean previous builds
    forge clean
    
    # Build contracts
    if [[ "${ENVIRONMENT}" == "production" ]]; then
        # Use production profile for gas optimization
        forge build --profile production
    else
        forge build
    fi
    
    log_success "Contracts built successfully"
}

run_tests() {
    log_info "Running contract tests..."
    
    cd "${CONTRACTS_DIR}"
    
    # Run full test suite
    forge test -vv
    
    # Run gas report for production
    if [[ "${ENVIRONMENT}" == "production" ]]; then
        log_info "Generating gas report..."
        forge test --gas-report > gas-report.txt
        log_info "Gas report saved to: gas-report.txt"
    fi
    
    log_success "All tests passed"
}

deploy_contracts() {
    log_info "Deploying contracts to ${ENVIRONMENT}..."
    
    cd "${CONTRACTS_DIR}"
    
    # Create deployments directory
    mkdir -p deployments
    
    # Set deployment parameters
    local rpc_endpoint=""
    case "${ENVIRONMENT}" in
        development)
            rpc_endpoint="http://localhost:8545"
            ;;
        staging)
            rpc_endpoint="${RPC_URL}"
            ;;
        production)
            rpc_endpoint="${RPC_URL}"
            ;;
    esac
    
    # Prepare deployment command
    local deploy_cmd="forge script script/Deploy.s.sol"
    deploy_cmd+=" --rpc-url ${rpc_endpoint}"
    deploy_cmd+=" --private-key ${DEPLOYER_PRIVATE_KEY}"
    
    if [[ "${DRY_RUN}" == "false" ]]; then
        deploy_cmd+=" --broadcast"
    else
        log_info "Running deployment simulation (dry run)..."
    fi
    
    if [[ "${VERIFY_CONTRACTS}" == "true" && "${ENVIRONMENT}" != "development" ]]; then
        deploy_cmd+=" --verify"
        
        # Add etherscan API key if available
        case "${CHAIN_ID}" in
            196) # X Layer mainnet
                if [[ -n "${XLAYER_API_KEY:-}" ]]; then
                    deploy_cmd+=" --etherscan-api-key ${XLAYER_API_KEY}"
                fi
                ;;
            195) # X Layer testnet
                if [[ -n "${XLAYER_API_KEY:-}" ]]; then
                    deploy_cmd+=" --etherscan-api-key ${XLAYER_API_KEY}"
                fi
                ;;
            1) # Ethereum mainnet
                if [[ -n "${ETHERSCAN_API_KEY:-}" ]]; then
                    deploy_cmd+=" --etherscan-api-key ${ETHERSCAN_API_KEY}"
                fi
                ;;
        esac
    fi
    
    # Execute deployment
    log_info "Executing deployment command..."
    log_info "Command: ${deploy_cmd}"
    
    if eval "${deploy_cmd}"; then
        log_success "Contracts deployed successfully"
    else
        log_error "Contract deployment failed"
    fi
    
    # Extract deployment information
    if [[ "${DRY_RUN}" == "false" ]]; then
        extract_deployment_info
    fi
}

extract_deployment_info() {
    log_info "Extracting deployment information..."
    
    local deployment_file="deployments/${CHAIN_ID}.json"
    
    if [[ -f "${deployment_file}" ]]; then
        # Read contract addresses from deployment file
        local settlement_address
        settlement_address=$(jq -r '.contracts.IntentSettlement' "${deployment_file}")
        
        log_info "Contract addresses:"
        log_info "  IntentSettlement: ${settlement_address}"
        
        # Update environment variables for other services
        local env_file="${DEPLOYMENT_DIR}/config/${ENVIRONMENT}.env"
        
        # Create backup
        cp "${env_file}" "${env_file}.backup.$(date +%s)"
        
        # Update contract addresses
        sed -i "s/SETTLEMENT_CONTRACT_ADDRESS=.*/SETTLEMENT_CONTRACT_ADDRESS=${settlement_address}/" "${env_file}"
        
        log_success "Environment file updated with contract addresses"
        
        # Save deployment summary
        create_deployment_summary "${settlement_address}"
    else
        log_error "Deployment file not found: ${deployment_file}"
    fi
}

create_deployment_summary() {
    local settlement_address="$1"
    
    local summary_file="${DEPLOYMENT_DIR}/deployments/${ENVIRONMENT}-${CHAIN_ID}-$(date +%Y%m%d-%H%M%S).json"
    
    mkdir -p "$(dirname "${summary_file}")"
    
    cat > "${summary_file}" << EOF
{
  "environment": "${ENVIRONMENT}",
  "chainId": ${CHAIN_ID},
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployer": "$(cast wallet address --private-key "${DEPLOYER_PRIVATE_KEY}")",
  "contracts": {
    "IntentSettlement": "${settlement_address}",
    "Permit2": "${PERMIT2_ADDRESS}",
    "Router": "${ROUTER_ADDRESS}"
  },
  "configuration": {
    "feeTreasury": "${FEE_TREASURY}",
    "owner": "${CONTRACT_OWNER}",
    "maxFeeBps": 30
  },
  "network": {
    "rpcUrl": "${RPC_URL}",
    "blockExplorer": $(get_block_explorer_url)
  },
  "verification": {
    "verified": ${VERIFY_CONTRACTS},
    "verificationUrl": "$(get_verification_url "${settlement_address}")"
  }
}
EOF
    
    log_success "Deployment summary saved to: ${summary_file}"
}

get_block_explorer_url() {
    case "${CHAIN_ID}" in
        196) echo "\"https://www.oklink.com/xlayer\"" ;;
        195) echo "\"https://www.oklink.com/xlayer-test\"" ;;
        1) echo "\"https://etherscan.io\"" ;;
        137) echo "\"https://polygonscan.com\"" ;;
        42161) echo "\"https://arbiscan.io\"" ;;
        8453) echo "\"https://basescan.org\"" ;;
        *) echo "null" ;;
    esac
}

get_verification_url() {
    local contract_address="$1"
    
    case "${CHAIN_ID}" in
        196) echo "https://www.oklink.com/xlayer/address/${contract_address}" ;;
        195) echo "https://www.oklink.com/xlayer-test/address/${contract_address}" ;;
        1) echo "https://etherscan.io/address/${contract_address}" ;;
        137) echo "https://polygonscan.com/address/${contract_address}" ;;
        42161) echo "https://arbiscan.io/address/${contract_address}" ;;
        8453) echo "https://basescan.org/address/${contract_address}" ;;
        *) echo "" ;;
    esac
}

verify_deployment() {
    if [[ "${VERIFY_CONTRACTS}" != "true" || "${DRY_RUN}" == "true" ]]; then
        return
    fi
    
    log_info "Verifying contract deployment..."
    
    local deployment_file="deployments/${CHAIN_ID}.json"
    
    if [[ ! -f "${deployment_file}" ]]; then
        log_warning "Deployment file not found, skipping verification"
        return
    fi
    
    local settlement_address
    settlement_address=$(jq -r '.contracts.IntentSettlement' "${deployment_file}")
    
    # Check if contract is deployed
    local code
    code=$(cast code "${settlement_address}" --rpc-url "${RPC_URL}")
    
    if [[ "${code}" == "0x" ]]; then
        log_error "No contract code found at address: ${settlement_address}"
    fi
    
    # Verify contract configuration
    local owner
    owner=$(cast call "${settlement_address}" "owner()(address)" --rpc-url "${RPC_URL}")
    
    if [[ "${owner}" != "${CONTRACT_OWNER}" ]]; then
        log_warning "Contract owner mismatch. Expected: ${CONTRACT_OWNER}, Got: ${owner}"
    fi
    
    log_success "Contract deployment verified successfully"
}

post_deployment_setup() {
    if [[ "${DRY_RUN}" == "true" ]]; then
        return
    fi
    
    log_info "Running post-deployment setup..."
    
    # Additional setup tasks can be added here
    # For example:
    # - Setting up initial solver registrations
    # - Configuring fee parameters
    # - Setting up monitoring
    
    log_success "Post-deployment setup completed"
}

cleanup() {
    log_info "Cleaning up temporary files..."
    # Add cleanup logic here if needed
}

main() {
    log_info "Starting smart contract deployment for ${ENVIRONMENT}"
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        log_warning "Running in DRY RUN mode - no transactions will be sent"
    fi
    
    # Validation and setup
    validate_environment
    check_prerequisites
    load_environment
    validate_network_connection
    
    # Build and test
    build_contracts
    run_tests
    
    # Deploy contracts
    deploy_contracts
    verify_deployment
    post_deployment_setup
    
    # Cleanup
    cleanup
    
    if [[ "${DRY_RUN}" == "false" ]]; then
        log_success "Smart contract deployment completed successfully!"
        
        echo -e "\n${GREEN}🚀 Deployment Summary${NC}"
        echo "Environment: ${ENVIRONMENT}"
        echo "Chain ID: ${CHAIN_ID}"
        echo "Verification: ${VERIFY_CONTRACTS}"
        
        if [[ -f "deployments/${CHAIN_ID}.json" ]]; then
            local settlement_address
            settlement_address=$(jq -r '.contracts.IntentSettlement' "deployments/${CHAIN_ID}.json")
            echo "IntentSettlement: ${settlement_address}"
            echo "Block Explorer: $(get_verification_url "${settlement_address}")"
        fi
    else
        log_success "Dry run completed successfully!"
    fi
}

# Trap for cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"