#!/bin/bash

# Intent-Based Trading Aggregator - Main Deployment Script
# Usage: ./deploy.sh [environment] [component]
# Example: ./deploy.sh production all
#          ./deploy.sh staging backend

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
COMPONENT="${2:-all}"
SKIP_HEALTH_CHECK="${3:-false}"

# Supported environments and components
ENVIRONMENTS=(development staging production)
COMPONENTS=(contracts backend frontend infrastructure monitoring all)

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

validate_component() {
    if [[ ! " ${COMPONENTS[@]} " =~ " ${COMPONENT} " ]]; then
        log_error "Invalid component: ${COMPONENT}. Supported: ${COMPONENTS[*]}"
    fi
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    local tools=("docker" "docker-compose" "node" "npm")
    
    if [[ "${ENVIRONMENT}" == "production" ]]; then
        tools+=("terraform" "kubectl" "helm")
    fi
    
    for tool in "${tools[@]}"; do
        if ! command -v "${tool}" &> /dev/null; then
            log_error "${tool} is required but not installed"
        fi
    done
    
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
    
    log_success "Environment configuration loaded"
}

deploy_infrastructure() {
    log_info "Deploying infrastructure for ${ENVIRONMENT}..."
    
    case "${ENVIRONMENT}" in
        development)
            log_info "Starting development environment with Docker Compose..."
            cd "${PROJECT_ROOT}"
            docker-compose up -d
            ;;
        staging|production)
            log_info "Deploying ${ENVIRONMENT} infrastructure with Terraform..."
            cd "${DEPLOYMENT_DIR}/terraform/aws"
            
            terraform init
            terraform workspace select "${ENVIRONMENT}" || terraform workspace new "${ENVIRONMENT}"
            terraform plan -var-file="../../../config/${ENVIRONMENT}.tfvars"
            terraform apply -var-file="../../../config/${ENVIRONMENT}.tfvars" -auto-approve
            ;;
    esac
    
    log_success "Infrastructure deployment completed"
}

deploy_contracts() {
    log_info "Deploying smart contracts..."
    
    cd "${PROJECT_ROOT}/contracts"
    
    # Build contracts
    npm run build
    
    # Deploy contracts based on environment
    case "${ENVIRONMENT}" in
        development)
            npm run deploy:local
            ;;
        staging)
            npm run deploy:testnet
            ;;
        production)
            npm run deploy:mainnet
            ;;
    esac
    
    log_success "Smart contracts deployed"
}

deploy_backend() {
    log_info "Deploying backend services..."
    
    case "${ENVIRONMENT}" in
        development)
            cd "${PROJECT_ROOT}"
            docker-compose up -d backend
            ;;
        staging|production)
            # Build and push Docker images
            cd "${PROJECT_ROOT}/backend"
            docker build -t "${DOCKER_REGISTRY}/intendly-backend:${ENVIRONMENT}" .
            docker push "${DOCKER_REGISTRY}/intendly-backend:${ENVIRONMENT}"
            
            # Deploy with Kubernetes
            cd "${DEPLOYMENT_DIR}/kubernetes"
            kubectl apply -k "overlays/${ENVIRONMENT}/backend"
            ;;
    esac
    
    log_success "Backend services deployed"
}

deploy_frontend() {
    log_info "Deploying frontend application..."
    
    cd "${PROJECT_ROOT}/web"
    
    case "${ENVIRONMENT}" in
        development)
            log_info "Frontend runs in development mode (npm run dev)"
            ;;
        staging|production)
            # Build Next.js application
            npm run build
            
            # Deploy to hosting platform
            if [[ -n "${VERCEL_TOKEN:-}" ]]; then
                npx vercel --prod --token "${VERCEL_TOKEN}"
            elif [[ -n "${NETLIFY_AUTH_TOKEN:-}" ]]; then
                npx netlify deploy --prod --auth "${NETLIFY_AUTH_TOKEN}"
            else
                # Deploy as Docker container
                docker build -t "${DOCKER_REGISTRY}/intendly-frontend:${ENVIRONMENT}" .
                docker push "${DOCKER_REGISTRY}/intendly-frontend:${ENVIRONMENT}"
                
                cd "${DEPLOYMENT_DIR}/kubernetes"
                kubectl apply -k "overlays/${ENVIRONMENT}/frontend"
            fi
            ;;
    esac
    
    log_success "Frontend application deployed"
}

deploy_monitoring() {
    log_info "Deploying monitoring stack..."
    
    case "${ENVIRONMENT}" in
        development)
            cd "${PROJECT_ROOT}"
            docker-compose up -d prometheus grafana
            ;;
        staging|production)
            cd "${DEPLOYMENT_DIR}/kubernetes"
            
            # Deploy Prometheus
            kubectl apply -k "overlays/${ENVIRONMENT}/monitoring/prometheus"
            
            # Deploy Grafana
            kubectl apply -k "overlays/${ENVIRONMENT}/monitoring/grafana"
            
            # Deploy AlertManager
            kubectl apply -k "overlays/${ENVIRONMENT}/monitoring/alertmanager"
            ;;
    esac
    
    log_success "Monitoring stack deployed"
}

run_health_checks() {
    if [[ "${SKIP_HEALTH_CHECK}" == "true" ]]; then
        log_warning "Skipping health checks"
        return
    fi
    
    log_info "Running post-deployment health checks..."
    
    "${DEPLOYMENT_DIR}/scripts/health-check.sh" "${ENVIRONMENT}"
    
    log_success "Health checks passed"
}

cleanup() {
    log_info "Cleaning up temporary files..."
    # Add cleanup logic here if needed
}

main() {
    log_info "Starting deployment of ${COMPONENT} to ${ENVIRONMENT}"
    
    # Validation
    validate_environment
    validate_component
    check_prerequisites
    load_environment
    
    # Deployment
    case "${COMPONENT}" in
        infrastructure)
            deploy_infrastructure
            ;;
        contracts)
            deploy_contracts
            ;;
        backend)
            deploy_backend
            ;;
        frontend)
            deploy_frontend
            ;;
        monitoring)
            deploy_monitoring
            ;;
        all)
            deploy_infrastructure
            deploy_contracts
            deploy_backend
            deploy_frontend
            deploy_monitoring
            ;;
    esac
    
    # Post-deployment
    run_health_checks
    cleanup
    
    log_success "Deployment completed successfully!"
    
    # Display access information
    case "${ENVIRONMENT}" in
        development)
            echo -e "\n${GREEN}🚀 Development Environment Ready!${NC}"
            echo "Backend API: http://localhost:3001"
            echo "Frontend: http://localhost:3000"
            echo "Grafana: http://localhost:3000 (admin/admin)"
            echo "Prometheus: http://localhost:9090"
            ;;
        staging)
            echo -e "\n${GREEN}🚀 Staging Environment Deployed!${NC}"
            echo "Backend API: ${STAGING_API_URL}"
            echo "Frontend: ${STAGING_FRONTEND_URL}"
            echo "Grafana: ${STAGING_GRAFANA_URL}"
            ;;
        production)
            echo -e "\n${GREEN}🚀 Production Environment Deployed!${NC}"
            echo "Backend API: ${PRODUCTION_API_URL}"
            echo "Frontend: ${PRODUCTION_FRONTEND_URL}"
            echo "Grafana: ${PRODUCTION_GRAFANA_URL}"
            ;;
    esac
}

# Trap for cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"