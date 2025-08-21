#!/bin/bash

# Intent-Based Trading Aggregator - Deployment Validation Script
# Usage: ./validate-deployment.sh [environment]
# Example: ./validate-deployment.sh production

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
ENVIRONMENT="${1:-production}"
VALIDATION_RESULTS=()
VALIDATION_ERRORS=()
VALIDATION_WARNINGS=()

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    VALIDATION_RESULTS+=("✅ $1")
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    VALIDATION_WARNINGS+=("⚠️ $1")
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    VALIDATION_ERRORS+=("❌ $1")
}

# Validation functions
validate_file_exists() {
    local file_path="$1"
    local description="$2"
    
    if [[ -f "${file_path}" ]]; then
        log_success "${description} exists: ${file_path}"
        return 0
    else
        log_error "${description} missing: ${file_path}"
        return 1
    fi
}

validate_directory_exists() {
    local dir_path="$1"
    local description="$2"
    
    if [[ -d "${dir_path}" ]]; then
        log_success "${description} exists: ${dir_path}"
        return 0
    else
        log_error "${description} missing: ${dir_path}"
        return 1
    fi
}

validate_script_executable() {
    local script_path="$1"
    local description="$2"
    
    if validate_file_exists "${script_path}" "${description}"; then
        if [[ -x "${script_path}" ]]; then
            log_success "${description} is executable"
            return 0
        else
            log_warning "${description} is not executable"
            chmod +x "${script_path}"
            log_success "Made ${description} executable"
            return 0
        fi
    fi
    return 1
}

validate_yaml_syntax() {
    local yaml_file="$1"
    local description="$2"
    
    if validate_file_exists "${yaml_file}" "${description}"; then
        if command -v yq &> /dev/null; then
            if yq eval '.' "${yaml_file}" > /dev/null 2>&1; then
                log_success "${description} has valid YAML syntax"
                return 0
            else
                log_error "${description} has invalid YAML syntax"
                return 1
            fi
        else
            # Fallback to basic validation with Python
            if python3 -c "import yaml; yaml.safe_load(open('${yaml_file}'))" 2>/dev/null; then
                log_success "${description} has valid YAML syntax"
                return 0
            else
                log_error "${description} has invalid YAML syntax"
                return 1
            fi
        fi
    fi
    return 1
}

validate_json_syntax() {
    local json_file="$1"
    local description="$2"
    
    if validate_file_exists "${json_file}" "${description}"; then
        if jq empty "${json_file}" 2>/dev/null; then
            log_success "${description} has valid JSON syntax"
            return 0
        else
            log_error "${description} has invalid JSON syntax"
            return 1
        fi
    fi
    return 1
}

# Validate project structure
validate_project_structure() {
    log_info "Validating project structure..."
    
    # Core directories
    validate_directory_exists "${PROJECT_ROOT}/backend" "Backend directory"
    validate_directory_exists "${PROJECT_ROOT}/contracts" "Contracts directory"
    validate_directory_exists "${PROJECT_ROOT}/web" "Web directory"
    validate_directory_exists "${PROJECT_ROOT}/solver-sdk" "Solver SDK directory"
    validate_directory_exists "${PROJECT_ROOT}/docs" "Documentation directory"
    validate_directory_exists "${DEPLOYMENT_DIR}" "Deployment directory"
    
    # Deployment subdirectories
    validate_directory_exists "${DEPLOYMENT_DIR}/scripts" "Deployment scripts directory"
    validate_directory_exists "${DEPLOYMENT_DIR}/config" "Configuration directory"
    validate_directory_exists "${DEPLOYMENT_DIR}/docker" "Docker directory"
    validate_directory_exists "${DEPLOYMENT_DIR}/kubernetes" "Kubernetes directory"
    validate_directory_exists "${DEPLOYMENT_DIR}/terraform" "Terraform directory"
    validate_directory_exists "${DEPLOYMENT_DIR}/monitoring" "Monitoring directory"
    
    # Core files
    validate_file_exists "${PROJECT_ROOT}/package.json" "Root package.json"
    validate_file_exists "${PROJECT_ROOT}/.env.example" "Environment example file"
    validate_file_exists "${PROJECT_ROOT}/README.md" "Main README file"
    validate_file_exists "${PROJECT_ROOT}/docker-compose.yml" "Docker Compose file"
    validate_file_exists "${PROJECT_ROOT}/docker-compose.prod.yml" "Production Docker Compose file"
}

# Validate deployment scripts
validate_deployment_scripts() {
    log_info "Validating deployment scripts..."
    
    # Main deployment scripts
    validate_script_executable "${DEPLOYMENT_DIR}/scripts/deploy.sh" "Main deployment script"
    validate_script_executable "${DEPLOYMENT_DIR}/scripts/health-check.sh" "Health check script"
    validate_script_executable "${DEPLOYMENT_DIR}/scripts/deploy-contracts.sh" "Contract deployment script"
    validate_script_executable "${DEPLOYMENT_DIR}/scripts/setup-ssl.sh" "SSL setup script"
    
    # Test script syntax
    log_info "Testing script syntax..."
    
    local scripts=(
        "${DEPLOYMENT_DIR}/scripts/deploy.sh"
        "${DEPLOYMENT_DIR}/scripts/health-check.sh"
        "${DEPLOYMENT_DIR}/scripts/deploy-contracts.sh"
        "${DEPLOYMENT_DIR}/scripts/setup-ssl.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [[ -f "${script}" ]]; then
            if bash -n "${script}"; then
                log_success "Script syntax valid: $(basename "${script}")"
            else
                log_error "Script syntax invalid: $(basename "${script}")"
            fi
        fi
    done
}

# Validate configuration files
validate_configuration_files() {
    log_info "Validating configuration files..."
    
    # Environment configuration files
    validate_file_exists "${DEPLOYMENT_DIR}/config/production.env.example" "Production environment template"
    validate_file_exists "${DEPLOYMENT_DIR}/config/staging.env.example" "Staging environment template"
    
    # Docker configurations
    validate_yaml_syntax "${PROJECT_ROOT}/docker-compose.yml" "Development Docker Compose"
    validate_yaml_syntax "${PROJECT_ROOT}/docker-compose.prod.yml" "Production Docker Compose"
    validate_yaml_syntax "${DEPLOYMENT_DIR}/docker/production/docker-compose.production.yml" "Enhanced Production Docker Compose"
    
    # Monitoring configurations
    validate_yaml_syntax "${DEPLOYMENT_DIR}/monitoring/prometheus/prometheus.yml" "Prometheus configuration"
    validate_yaml_syntax "${DEPLOYMENT_DIR}/monitoring/prometheus/rules/intendly-alerts.yml" "Prometheus alert rules"
    validate_yaml_syntax "${DEPLOYMENT_DIR}/monitoring/loki/loki.yml" "Loki configuration"
    validate_yaml_syntax "${DEPLOYMENT_DIR}/monitoring/promtail/promtail.yml" "Promtail configuration"
    validate_yaml_syntax "${DEPLOYMENT_DIR}/monitoring/alertmanager/alertmanager.yml" "Alertmanager configuration"
    
    # Grafana dashboard
    validate_json_syntax "${DEPLOYMENT_DIR}/monitoring/grafana/dashboards/intendly-overview.json" "Grafana dashboard"
    
    # Nginx configuration
    validate_file_exists "${DEPLOYMENT_DIR}/docker/nginx/nginx.conf" "Nginx configuration"
}

# Validate Kubernetes manifests
validate_kubernetes_manifests() {
    log_info "Validating Kubernetes manifests..."
    
    # Check if kubectl is available
    if command -v kubectl &> /dev/null; then
        local k8s_files=(
            "${DEPLOYMENT_DIR}/kubernetes/base/namespace.yaml"
            "${DEPLOYMENT_DIR}/kubernetes/base/backend-deployment.yaml"
            "${DEPLOYMENT_DIR}/kubernetes/base/backend-service.yaml"
        )
        
        for k8s_file in "${k8s_files[@]}"; do
            if [[ -f "${k8s_file}" ]]; then
                if kubectl apply --dry-run=client -f "${k8s_file}" > /dev/null 2>&1; then
                    log_success "Kubernetes manifest valid: $(basename "${k8s_file}")"
                else
                    log_error "Kubernetes manifest invalid: $(basename "${k8s_file}")"
                fi
            fi
        done
    else
        log_warning "kubectl not available, skipping Kubernetes manifest validation"
    fi
    
    # Basic YAML syntax validation
    validate_yaml_syntax "${DEPLOYMENT_DIR}/kubernetes/base/namespace.yaml" "Kubernetes namespace"
    validate_yaml_syntax "${DEPLOYMENT_DIR}/kubernetes/base/backend-deployment.yaml" "Kubernetes backend deployment"
    validate_yaml_syntax "${DEPLOYMENT_DIR}/kubernetes/base/backend-service.yaml" "Kubernetes backend service"
}

# Validate Terraform configurations
validate_terraform_configurations() {
    log_info "Validating Terraform configurations..."
    
    if command -v terraform &> /dev/null; then
        local tf_dir="${DEPLOYMENT_DIR}/terraform/aws"
        
        if [[ -d "${tf_dir}" ]]; then
            cd "${tf_dir}"
            
            # Initialize Terraform (without backend)
            if terraform init -backend=false > /dev/null 2>&1; then
                log_success "Terraform initialization successful"
                
                # Validate configuration
                if terraform validate > /dev/null 2>&1; then
                    log_success "Terraform configuration is valid"
                else
                    log_error "Terraform configuration validation failed"
                fi
                
                # Format check
                if terraform fmt -check > /dev/null 2>&1; then
                    log_success "Terraform files are properly formatted"
                else
                    log_warning "Terraform files need formatting"
                fi
            else
                log_error "Terraform initialization failed"
            fi
            
            cd - > /dev/null
        fi
    else
        log_warning "Terraform not available, skipping Terraform validation"
    fi
    
    # Basic file existence
    validate_file_exists "${DEPLOYMENT_DIR}/terraform/aws/main.tf" "Terraform main configuration"
    validate_file_exists "${DEPLOYMENT_DIR}/terraform/aws/variables.tf" "Terraform variables"
    validate_file_exists "${DEPLOYMENT_DIR}/terraform/aws/outputs.tf" "Terraform outputs"
}

# Validate smart contracts
validate_smart_contracts() {
    log_info "Validating smart contracts..."
    
    if command -v forge &> /dev/null; then
        cd "${PROJECT_ROOT}/contracts"
        
        # Check if contracts compile
        if forge build > /dev/null 2>&1; then
            log_success "Smart contracts compile successfully"
        else
            log_error "Smart contract compilation failed"
        fi
        
        # Check if tests pass
        if forge test > /dev/null 2>&1; then
            log_success "Smart contract tests pass"
        else
            log_error "Smart contract tests failed"
        fi
        
        cd - > /dev/null
    else
        log_warning "Foundry not available, skipping smart contract validation"
    fi
    
    # Basic file validation
    validate_file_exists "${PROJECT_ROOT}/contracts/src/IntentSettlement.sol" "IntentSettlement contract"
    validate_file_exists "${PROJECT_ROOT}/contracts/script/Deploy.s.sol" "Contract deployment script"
    validate_file_exists "${PROJECT_ROOT}/contracts/script/Verify.s.sol" "Contract verification script"
    validate_file_exists "${PROJECT_ROOT}/contracts/foundry.toml" "Foundry configuration"
}

# Validate Node.js projects
validate_nodejs_projects() {
    log_info "Validating Node.js projects..."
    
    local projects=("backend" "web" "solver-sdk")
    
    for project in "${projects[@]}"; do
        local project_dir="${PROJECT_ROOT}/${project}"
        
        if [[ -d "${project_dir}" ]]; then
            cd "${project_dir}"
            
            # Check package.json
            if validate_json_syntax "package.json" "${project} package.json"; then
                # Check if dependencies are installed
                if [[ -d "node_modules" ]]; then
                    log_success "${project} dependencies are installed"
                else
                    log_warning "${project} dependencies not installed"
                fi
                
                # Check TypeScript configuration
                if [[ -f "tsconfig.json" ]]; then
                    validate_json_syntax "tsconfig.json" "${project} TypeScript config"
                fi
                
                # Basic build test (if available)
                if jq -e '.scripts.build' package.json > /dev/null 2>&1; then
                    log_info "Testing ${project} build..."
                    if npm run build > /dev/null 2>&1; then
                        log_success "${project} builds successfully"
                    else
                        log_warning "${project} build failed or not configured"
                    fi
                fi
            fi
            
            cd - > /dev/null
        fi
    done
}

# Validate documentation
validate_documentation() {
    log_info "Validating documentation..."
    
    # Core documentation files
    local docs=(
        "${PROJECT_ROOT}/README.md:Main README"
        "${PROJECT_ROOT}/docs/README.md:Documentation index"
        "${PROJECT_ROOT}/docs/user-guide.md:User guide"
        "${PROJECT_ROOT}/docs/developer-guide.md:Developer guide"
        "${PROJECT_ROOT}/docs/api-documentation.md:API documentation"
        "${PROJECT_ROOT}/docs/operations-manual.md:Operations manual"
        "${PROJECT_ROOT}/docs/security-guide.md:Security guide"
        "${PROJECT_ROOT}/docs/demo-script.md:Demo script"
        "${DEPLOYMENT_DIR}/README.md:Deployment README"
    )
    
    for doc_info in "${docs[@]}"; do
        local doc_path="${doc_info%:*}"
        local doc_name="${doc_info#*:}"
        
        validate_file_exists "${doc_path}" "${doc_name}"
        
        # Check for basic markdown structure
        if [[ -f "${doc_path}" ]]; then
            if grep -q "^# " "${doc_path}"; then
                log_success "${doc_name} has proper markdown structure"
            else
                log_warning "${doc_name} may be missing main heading"
            fi
        fi
    done
    
    # Check for broken internal links (basic check)
    log_info "Checking for common documentation issues..."
    
    if command -v grep &> /dev/null; then
        # Check for TODO items in documentation
        local todo_count
        todo_count=$(find "${PROJECT_ROOT}/docs" -name "*.md" -exec grep -l "TODO\|FIXME\|XXX" {} \; | wc -l)
        
        if [[ "${todo_count}" -gt 0 ]]; then
            log_warning "Found ${todo_count} documentation file(s) with TODO items"
        else
            log_success "No TODO items found in documentation"
        fi
    fi
}

# Validate GitHub Actions
validate_github_actions() {
    log_info "Validating GitHub Actions..."
    
    validate_yaml_syntax "${PROJECT_ROOT}/.github/workflows/deploy.yml" "GitHub Actions deployment workflow"
    
    # Check for required secrets in workflow
    if [[ -f "${PROJECT_ROOT}/.github/workflows/deploy.yml" ]]; then
        local required_secrets=(
            "DEPLOYER_PRIVATE_KEY_PRODUCTION"
            "DATABASE_PASSWORD_PRODUCTION"
            "JWT_SECRET_PRODUCTION"
            "AWS_ACCESS_KEY_ID"
            "AWS_SECRET_ACCESS_KEY"
        )
        
        for secret in "${required_secrets[@]}"; do
            if grep -q "${secret}" "${PROJECT_ROOT}/.github/workflows/deploy.yml"; then
                log_success "GitHub Actions references required secret: ${secret}"
            else
                log_warning "GitHub Actions may be missing secret reference: ${secret}"
            fi
        done
    fi
}

# Validate environment configurations
validate_environment_configurations() {
    log_info "Validating environment configurations..."
    
    local env_files=(
        "${PROJECT_ROOT}/.env.example:Root environment example"
        "${DEPLOYMENT_DIR}/config/production.env.example:Production environment template"
        "${DEPLOYMENT_DIR}/config/staging.env.example:Staging environment template"
    )
    
    for env_info in "${env_files[@]}"; do
        local env_path="${env_info%:*}"
        local env_name="${env_info#*:}"
        
        if validate_file_exists "${env_path}" "${env_name}"; then
            # Check for required environment variables
            local required_vars=(
                "CHAIN_ID"
                "RPC_URL"
                "DATABASE_URL"
                "REDIS_URL"
                "JWT_SECRET"
            )
            
            for var in "${required_vars[@]}"; do
                if grep -q "^${var}=" "${env_path}"; then
                    log_success "${env_name} contains ${var}"
                else
                    log_warning "${env_name} may be missing ${var}"
                fi
            done
        fi
    done
}

# Test basic deployment functionality
test_deployment_functionality() {
    log_info "Testing basic deployment functionality..."
    
    # Test health check script
    if [[ -x "${DEPLOYMENT_DIR}/scripts/health-check.sh" ]]; then
        log_info "Testing health check script syntax..."
        if bash -n "${DEPLOYMENT_DIR}/scripts/health-check.sh"; then
            log_success "Health check script syntax is valid"
        else
            log_error "Health check script has syntax errors"
        fi
    fi
    
    # Test deploy script
    if [[ -x "${DEPLOYMENT_DIR}/scripts/deploy.sh" ]]; then
        log_info "Testing deploy script syntax..."
        if bash -n "${DEPLOYMENT_DIR}/scripts/deploy.sh"; then
            log_success "Deploy script syntax is valid"
        else
            log_error "Deploy script has syntax errors"
        fi
    fi
    
    # Test Docker Compose configuration
    if command -v docker-compose &> /dev/null; then
        log_info "Testing Docker Compose configuration..."
        if docker-compose -f "${PROJECT_ROOT}/docker-compose.yml" config > /dev/null 2>&1; then
            log_success "Docker Compose configuration is valid"
        else
            log_error "Docker Compose configuration is invalid"
        fi
    fi
}

# Generate validation report
generate_validation_report() {
    echo -e "\n${BLUE}===========================================${NC}"
    echo -e "${BLUE}   DEPLOYMENT VALIDATION REPORT${NC}"
    echo -e "${BLUE}===========================================${NC}\n"
    
    echo -e "${GREEN}✅ SUCCESSFUL VALIDATIONS (${#VALIDATION_RESULTS[@]})${NC}"
    for result in "${VALIDATION_RESULTS[@]}"; do
        echo "  ${result}"
    done
    
    if [[ ${#VALIDATION_WARNINGS[@]} -gt 0 ]]; then
        echo -e "\n${YELLOW}⚠️  WARNINGS (${#VALIDATION_WARNINGS[@]})${NC}"
        for warning in "${VALIDATION_WARNINGS[@]}"; do
            echo "  ${warning}"
        done
    fi
    
    if [[ ${#VALIDATION_ERRORS[@]} -gt 0 ]]; then
        echo -e "\n${RED}❌ ERRORS (${#VALIDATION_ERRORS[@]})${NC}"
        for error in "${VALIDATION_ERRORS[@]}"; do
            echo "  ${error}"
        done
        echo -e "\n${RED}⚠️  DEPLOYMENT NOT READY - Fix errors before deploying${NC}"
        return 1
    else
        echo -e "\n${GREEN}🎉 DEPLOYMENT VALIDATION PASSED${NC}"
        echo -e "${GREEN}✅ All critical validations successful${NC}"
        
        if [[ ${#VALIDATION_WARNINGS[@]} -gt 0 ]]; then
            echo -e "${YELLOW}⚠️  ${#VALIDATION_WARNINGS[@]} warning(s) - review before production deployment${NC}"
        fi
        
        echo -e "\n${BLUE}🚀 READY FOR DEPLOYMENT${NC}"
        return 0
    fi
}

# Main validation function
main() {
    log_info "Starting comprehensive deployment validation for ${ENVIRONMENT} environment"
    
    # Run all validations
    validate_project_structure
    validate_deployment_scripts
    validate_configuration_files
    validate_kubernetes_manifests
    validate_terraform_configurations
    validate_smart_contracts
    validate_nodejs_projects
    validate_documentation
    validate_github_actions
    validate_environment_configurations
    test_deployment_functionality
    
    # Generate final report
    generate_validation_report
}

# Run main function
main "$@"