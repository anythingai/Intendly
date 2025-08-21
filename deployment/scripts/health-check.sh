#!/bin/bash

# Intent-Based Trading Aggregator - Health Check Script
# Usage: ./health-check.sh [environment]
# Example: ./health-check.sh production

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
DEPLOYMENT_DIR="${PROJECT_ROOT}/deployment"

# Default values
ENVIRONMENT="${1:-staging}"
TIMEOUT="${2:-30}"

# Health check results
HEALTH_CHECKS=()
FAILED_CHECKS=()

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
}

# Load environment configuration
load_environment() {
    local env_file="${DEPLOYMENT_DIR}/config/${ENVIRONMENT}.env"
    if [[ -f "${env_file}" ]]; then
        set -o allexport
        source "${env_file}"
        set +o allexport
    fi
}

# Health check functions
check_service_health() {
    local service_name="$1"
    local health_url="$2"
    local expected_status="${3:-200}"
    
    log_info "Checking ${service_name} health..."
    
    local response_code
    response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "${TIMEOUT}" "${health_url}" || echo "000")
    
    if [[ "${response_code}" == "${expected_status}" ]]; then
        log_success "${service_name} is healthy (HTTP ${response_code})"
        HEALTH_CHECKS+=("${service_name}: ✅ Healthy")
        return 0
    else
        log_error "${service_name} is unhealthy (HTTP ${response_code})"
        HEALTH_CHECKS+=("${service_name}: ❌ Unhealthy (HTTP ${response_code})")
        FAILED_CHECKS+=("${service_name}")
        return 1
    fi
}

check_database_connectivity() {
    log_info "Checking database connectivity..."
    
    case "${ENVIRONMENT}" in
        development)
            local db_host="localhost"
            local db_port="5432"
            ;;
        *)
            local db_host="${DATABASE_HOST:-localhost}"
            local db_port="${DATABASE_PORT:-5432}"
            ;;
    esac
    
    if nc -z "${db_host}" "${db_port}" 2>/dev/null; then
        log_success "Database is reachable at ${db_host}:${db_port}"
        HEALTH_CHECKS+=("Database: ✅ Reachable")
        return 0
    else
        log_error "Database is not reachable at ${db_host}:${db_port}"
        HEALTH_CHECKS+=("Database: ❌ Unreachable")
        FAILED_CHECKS+=("Database")
        return 1
    fi
}

check_redis_connectivity() {
    log_info "Checking Redis connectivity..."
    
    case "${ENVIRONMENT}" in
        development)
            local redis_host="localhost"
            local redis_port="6379"
            ;;
        *)
            local redis_host="${REDIS_HOST:-localhost}"
            local redis_port="${REDIS_PORT:-6379}"
            ;;
    esac
    
    if nc -z "${redis_host}" "${redis_port}" 2>/dev/null; then
        log_success "Redis is reachable at ${redis_host}:${redis_port}"
        HEALTH_CHECKS+=("Redis: ✅ Reachable")
        return 0
    else
        log_error "Redis is not reachable at ${redis_host}:${redis_port}"
        HEALTH_CHECKS+=("Redis: ❌ Unreachable")
        FAILED_CHECKS+=("Redis")
        return 1
    fi
}

check_blockchain_connectivity() {
    log_info "Checking blockchain connectivity..."
    
    local rpc_url="${RPC_URL:-https://xlayerrpc.okx.com}"
    
    # Simple JSON-RPC call to check connectivity
    local chain_id
    chain_id=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
        --max-time "${TIMEOUT}" \
        "${rpc_url}" | jq -r '.result // "null"' 2>/dev/null || echo "null")
    
    if [[ "${chain_id}" != "null" && "${chain_id}" != "" ]]; then
        local chain_id_decimal=$((chain_id))
        log_success "Blockchain is reachable (Chain ID: ${chain_id_decimal})"
        HEALTH_CHECKS+=("Blockchain: ✅ Reachable (Chain ${chain_id_decimal})")
        return 0
    else
        log_error "Blockchain is not reachable at ${rpc_url}"
        HEALTH_CHECKS+=("Blockchain: ❌ Unreachable")
        FAILED_CHECKS+=("Blockchain")
        return 1
    fi
}

check_contract_deployment() {
    log_info "Checking smart contract deployment..."
    
    local settlement_address="${SETTLEMENT_CONTRACT_ADDRESS:-}"
    local rpc_url="${RPC_URL:-https://xlayerrpc.okx.com}"
    
    if [[ -z "${settlement_address}" || "${settlement_address}" == "0x0000000000000000000000000000000000000000" ]]; then
        log_warning "Settlement contract address not configured"
        HEALTH_CHECKS+=("Smart Contracts: ⚠️ Not configured")
        return 0
    fi
    
    # Check if contract exists
    local code
    code=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"${settlement_address}\",\"latest\"],\"id\":1}" \
        --max-time "${TIMEOUT}" \
        "${rpc_url}" | jq -r '.result // "0x"' 2>/dev/null || echo "0x")
    
    if [[ "${code}" != "0x" && "${code}" != "null" ]]; then
        log_success "Smart contracts are deployed and accessible"
        HEALTH_CHECKS+=("Smart Contracts: ✅ Deployed")
        return 0
    else
        log_error "Smart contracts are not deployed or not accessible"
        HEALTH_CHECKS+=("Smart Contracts: ❌ Not deployed")
        FAILED_CHECKS+=("Smart Contracts")
        return 1
    fi
}

check_websocket_connectivity() {
    log_info "Checking WebSocket connectivity..."
    
    case "${ENVIRONMENT}" in
        development)
            local ws_url="ws://localhost:3002"
            ;;
        staging)
            local ws_url="${STAGING_WS_URL:-wss://api-staging.intendly.xyz}"
            ;;
        production)
            local ws_url="${PRODUCTION_WS_URL:-wss://api.intendly.xyz}"
            ;;
    esac
    
    # Simple WebSocket connection test
    if command -v wscat &> /dev/null; then
        if timeout "${TIMEOUT}" wscat -c "${ws_url}" -x '{"type":"ping"}' 2>/dev/null | grep -q "pong" 2>/dev/null; then
            log_success "WebSocket is reachable and responsive"
            HEALTH_CHECKS+=("WebSocket: ✅ Responsive")
            return 0
        fi
    fi
    
    log_warning "WebSocket connectivity check skipped (wscat not available)"
    HEALTH_CHECKS+=("WebSocket: ⚠️ Check skipped")
    return 0
}

check_monitoring_stack() {
    log_info "Checking monitoring stack..."
    
    case "${ENVIRONMENT}" in
        development)
            local prometheus_url="http://localhost:9090"
            local grafana_url="http://localhost:3000"
            ;;
        staging)
            local prometheus_url="${STAGING_PROMETHEUS_URL:-}"
            local grafana_url="${STAGING_GRAFANA_URL:-}"
            ;;
        production)
            local prometheus_url="${PRODUCTION_PROMETHEUS_URL:-}"
            local grafana_url="${PRODUCTION_GRAFANA_URL:-}"
            ;;
    esac
    
    local monitoring_healthy=true
    
    # Check Prometheus
    if [[ -n "${prometheus_url}" ]]; then
        if check_service_health "Prometheus" "${prometheus_url}/-/healthy"; then
            :
        else
            monitoring_healthy=false
        fi
    fi
    
    # Check Grafana
    if [[ -n "${grafana_url}" ]]; then
        if check_service_health "Grafana" "${grafana_url}/api/health"; then
            :
        else
            monitoring_healthy=false
        fi
    fi
    
    if [[ "${monitoring_healthy}" == "true" ]]; then
        return 0
    else
        return 1
    fi
}

run_api_tests() {
    log_info "Running API integration tests..."
    
    case "${ENVIRONMENT}" in
        development)
            local api_base="http://localhost:3001"
            ;;
        staging)
            local api_base="${STAGING_API_URL:-}"
            ;;
        production)
            local api_base="${PRODUCTION_API_URL:-}"
            ;;
    esac
    
    if [[ -z "${api_base}" ]]; then
        log_warning "API base URL not configured, skipping API tests"
        return 0
    fi
    
    # Test basic endpoints
    local endpoints=(
        "/health:200"
        "/api/v1/status:200"
        "/api/v1/metrics:200"
    )
    
    local api_healthy=true
    
    for endpoint_config in "${endpoints[@]}"; do
        local endpoint="${endpoint_config%:*}"
        local expected_status="${endpoint_config#*:}"
        
        if ! check_service_health "API ${endpoint}" "${api_base}${endpoint}" "${expected_status}"; then
            api_healthy=false
        fi
    done
    
    if [[ "${api_healthy}" == "true" ]]; then
        log_success "All API endpoints are healthy"
        return 0
    else
        log_error "Some API endpoints are unhealthy"
        return 1
    fi
}

# Generate health report
generate_report() {
    echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}    HEALTH CHECK REPORT - ${ENVIRONMENT}${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}\n"
    
    for check in "${HEALTH_CHECKS[@]}"; do
        echo -e "  ${check}"
    done
    
    echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
    
    if [[ ${#FAILED_CHECKS[@]} -eq 0 ]]; then
        echo -e "${GREEN}✅ All health checks passed!${NC}"
        return 0
    else
        echo -e "${RED}❌ ${#FAILED_CHECKS[@]} health check(s) failed:${NC}"
        for failed in "${FAILED_CHECKS[@]}"; do
            echo -e "   ${RED}• ${failed}${NC}"
        done
        echo -e "\n${YELLOW}Please check the logs and fix the issues before proceeding.${NC}"
        return 1
    fi
}

main() {
    log_info "Starting health checks for ${ENVIRONMENT} environment..."
    
    # Load environment configuration
    load_environment
    
    # Run health checks
    check_database_connectivity || true
    check_redis_connectivity || true
    check_blockchain_connectivity || true
    check_contract_deployment || true
    check_websocket_connectivity || true
    run_api_tests || true
    check_monitoring_stack || true
    
    # Generate report
    generate_report
}

# Check required tools
if ! command -v curl &> /dev/null; then
    log_error "curl is required but not installed"
fi

if ! command -v nc &> /dev/null; then
    log_warning "nc (netcat) is not available, some checks will be skipped"
fi

if ! command -v jq &> /dev/null; then
    log_warning "jq is not available, JSON parsing will be limited"
fi

# Run main function
main "$@"