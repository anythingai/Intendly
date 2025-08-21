#!/bin/bash

# Intent-Based Trading Aggregator - SSL Certificate Setup Script
# Usage: ./setup-ssl.sh [environment] [domain]
# Example: ./setup-ssl.sh production intendly.xyz

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

# Default values
ENVIRONMENT="${1:-production}"
DOMAIN="${2:-intendly.xyz}"
EMAIL="${3:-admin@intendly.xyz}"

# SSL configuration
SSL_DIR="/etc/ssl/intendly"
CERT_PATH="${SSL_DIR}/${DOMAIN}.crt"
KEY_PATH="${SSL_DIR}/${DOMAIN}.key"
CSR_PATH="${SSL_DIR}/${DOMAIN}.csr"

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites for SSL setup..."
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root for SSL certificate management"
    fi
    
    # Check required tools
    local tools=("openssl" "curl" "certbot")
    
    for tool in "${tools[@]}"; do
        if ! command -v "${tool}" &> /dev/null; then
            log_warning "${tool} not found, attempting to install..."
            
            # Install missing tools
            case "${tool}" in
                "certbot")
                    if command -v apt-get &> /dev/null; then
                        apt-get update && apt-get install -y certbot python3-certbot-nginx
                    elif command -v yum &> /dev/null; then
                        yum install -y certbot python3-certbot-nginx
                    else
                        log_error "Could not install certbot. Please install manually."
                    fi
                    ;;
                "openssl")
                    if command -v apt-get &> /dev/null; then
                        apt-get update && apt-get install -y openssl
                    elif command -v yum &> /dev/null; then
                        yum install -y openssl
                    fi
                    ;;
                "curl")
                    if command -v apt-get &> /dev/null; then
                        apt-get update && apt-get install -y curl
                    elif command -v yum &> /dev/null; then
                        yum install -y curl
                    fi
                    ;;
            esac
        fi
    done
    
    log_success "Prerequisites check completed"
}

# Create SSL directory
setup_ssl_directory() {
    log_info "Setting up SSL directory structure..."
    
    mkdir -p "${SSL_DIR}"
    chmod 700 "${SSL_DIR}"
    
    log_success "SSL directory created: ${SSL_DIR}"
}

# Generate self-signed certificate for development
generate_self_signed_cert() {
    log_info "Generating self-signed certificate for development..."
    
    # Generate private key
    openssl genrsa -out "${KEY_PATH}" 2048
    chmod 600 "${KEY_PATH}"
    
    # Generate certificate signing request
    openssl req -new -key "${KEY_PATH}" -out "${CSR_PATH}" -subj "/C=US/ST=CA/L=San Francisco/O=Intendly/CN=${DOMAIN}/emailAddress=${EMAIL}"
    
    # Generate self-signed certificate
    openssl x509 -req -in "${CSR_PATH}" -signkey "${KEY_PATH}" -out "${CERT_PATH}" -days 365 \
        -extensions v3_req -extfile <(cat <<EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = CA
L = San Francisco
O = Intendly
CN = ${DOMAIN}
emailAddress = ${EMAIL}

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${DOMAIN}
DNS.2 = *.${DOMAIN}
DNS.3 = api.${DOMAIN}
DNS.4 = app.${DOMAIN}
DNS.5 = monitoring.${DOMAIN}
EOF
    )
    
    chmod 644 "${CERT_PATH}"
    
    log_success "Self-signed certificate generated"
    log_warning "Self-signed certificates should only be used for development!"
}

# Get Let's Encrypt certificate for production
get_letsencrypt_cert() {
    log_info "Obtaining Let's Encrypt certificate for production..."
    
    # Check if domain resolves to this server
    local domain_ip
    domain_ip=$(dig +short "${DOMAIN}" | tail -n1)
    local server_ip
    server_ip=$(curl -s ifconfig.me)
    
    if [[ "${domain_ip}" != "${server_ip}" ]]; then
        log_warning "Domain ${DOMAIN} does not resolve to this server (${server_ip})"
        log_warning "DNS resolution may take time to propagate"
    fi
    
    # Stop nginx if running to avoid port conflicts
    if systemctl is-active --quiet nginx; then
        log_info "Stopping nginx for certificate generation..."
        systemctl stop nginx
        local restart_nginx=true
    fi
    
    # Get certificate using standalone mode
    certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "${EMAIL}" \
        --domains "${DOMAIN},api.${DOMAIN},app.${DOMAIN},monitoring.${DOMAIN}" \
        --cert-path "${CERT_PATH}" \
        --key-path "${KEY_PATH}"
    
    # Copy certificates from Let's Encrypt directory
    if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
        cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${CERT_PATH}"
        cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "${KEY_PATH}"
        chmod 644 "${CERT_PATH}"
        chmod 600 "${KEY_PATH}"
        log_success "Let's Encrypt certificate obtained and installed"
    else
        log_error "Failed to obtain Let's Encrypt certificate"
    fi
    
    # Restart nginx if it was running
    if [[ "${restart_nginx:-false}" == "true" ]]; then
        log_info "Restarting nginx..."
        systemctl start nginx
    fi
}

# Setup certificate auto-renewal
setup_cert_renewal() {
    log_info "Setting up certificate auto-renewal..."
    
    # Create renewal script
    cat > "/usr/local/bin/renew-intendly-certs.sh" << 'EOF'
#!/bin/bash
# Intendly SSL Certificate Renewal Script

# Renew certificates
certbot renew --quiet --no-self-upgrade

# Reload nginx if certificates were renewed
if [[ $? -eq 0 ]]; then
    systemctl reload nginx
    echo "$(date): Certificates renewed and nginx reloaded" >> /var/log/intendly-cert-renewal.log
fi
EOF
    
    chmod +x "/usr/local/bin/renew-intendly-certs.sh"
    
    # Add cron job for automatic renewal
    (crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/renew-intendly-certs.sh") | crontab -
    
    log_success "Certificate auto-renewal configured"
}

# Validate certificate
validate_certificate() {
    log_info "Validating SSL certificate..."
    
    if [[ ! -f "${CERT_PATH}" ]] || [[ ! -f "${KEY_PATH}" ]]; then
        log_error "Certificate files not found"
    fi
    
    # Check certificate validity
    local cert_info
    cert_info=$(openssl x509 -in "${CERT_PATH}" -text -noout)
    
    # Extract expiration date
    local expiry_date
    expiry_date=$(echo "${cert_info}" | grep "Not After" | cut -d: -f2- | xargs)
    log_info "Certificate expires: ${expiry_date}"
    
    # Check if certificate is valid for domain
    if echo "${cert_info}" | grep -q "CN=${DOMAIN}"; then
        log_success "Certificate is valid for domain: ${DOMAIN}"
    else
        log_warning "Certificate may not be valid for domain: ${DOMAIN}"
    fi
    
    # Check certificate and key match
    local cert_hash
    cert_hash=$(openssl x509 -noout -modulus -in "${CERT_PATH}" | openssl md5)
    local key_hash
    key_hash=$(openssl rsa -noout -modulus -in "${KEY_PATH}" | openssl md5)
    
    if [[ "${cert_hash}" == "${key_hash}" ]]; then
        log_success "Certificate and private key match"
    else
        log_error "Certificate and private key do not match"
    fi
}

# Update nginx configuration
update_nginx_config() {
    log_info "Updating nginx configuration for SSL..."
    
    local nginx_conf="/etc/nginx/sites-available/intendly"
    
    # Create nginx SSL configuration
    cat > "${nginx_conf}" << EOF
server {
    listen 80;
    server_name ${DOMAIN} api.${DOMAIN} app.${DOMAIN} monitoring.${DOMAIN};
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.${DOMAIN};
    
    # SSL Configuration
    ssl_certificate ${CERT_PATH};
    ssl_certificate_key ${KEY_PATH};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubdomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # API proxy
    location / {
        proxy_pass http://backend-relayer:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # WebSocket proxy
    location /ws {
        proxy_pass http://websocket-server:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name app.${DOMAIN};
    
    # SSL Configuration (same as above)
    ssl_certificate ${CERT_PATH};
    ssl_certificate_key ${KEY_PATH};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubdomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Frontend proxy (or serve static files)
    location / {
        # If using static files
        root /var/www/intendly;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        # If using Next.js server
        # proxy_pass http://frontend:3000;
    }
}
EOF
    
    # Enable the site
    if [[ ! -L "/etc/nginx/sites-enabled/intendly" ]]; then
        ln -s "/etc/nginx/sites-available/intendly" "/etc/nginx/sites-enabled/intendly"
    fi
    
    # Test nginx configuration
    if nginx -t; then
        log_success "Nginx configuration is valid"
        systemctl reload nginx
    else
        log_error "Nginx configuration is invalid"
    fi
}

# Test SSL certificate
test_ssl_certificate() {
    log_info "Testing SSL certificate..."
    
    # Test HTTPS connection
    if curl -sSf "https://${DOMAIN}" --connect-timeout 10 >/dev/null 2>&1; then
        log_success "HTTPS connection successful"
    else
        log_warning "HTTPS connection failed - this may be expected if services aren't running"
    fi
    
    # Test SSL certificate with OpenSSL
    local ssl_test
    ssl_test=$(echo | openssl s_client -servername "${DOMAIN}" -connect "${DOMAIN}:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        log_success "SSL certificate test passed"
        echo "${ssl_test}"
    else
        log_warning "SSL certificate test failed - certificate may not be accessible externally"
    fi
}

# Main function
main() {
    log_info "Setting up SSL certificates for ${ENVIRONMENT} environment"
    log_info "Domain: ${DOMAIN}"
    log_info "Email: ${EMAIL}"
    
    check_prerequisites
    setup_ssl_directory
    
    case "${ENVIRONMENT}" in
        "development")
            generate_self_signed_cert
            ;;
        "staging"|"production")
            get_letsencrypt_cert
            setup_cert_renewal
            ;;
        *)
            log_error "Invalid environment: ${ENVIRONMENT}. Use: development, staging, or production"
            ;;
    esac
    
    validate_certificate
    update_nginx_config
    test_ssl_certificate
    
    log_success "SSL setup completed successfully!"
    
    echo -e "\n${GREEN}📋 SSL Setup Summary${NC}"
    echo "Environment: ${ENVIRONMENT}"
    echo "Domain: ${DOMAIN}"
    echo "Certificate: ${CERT_PATH}"
    echo "Private Key: ${KEY_PATH}"
    echo "Auto-renewal: $([ "${ENVIRONMENT}" != "development" ] && echo "Enabled" || echo "Disabled")"
    
    if [[ "${ENVIRONMENT}" == "development" ]]; then
        echo -e "\n${YELLOW}⚠️  Development Notes:${NC}"
        echo "- Self-signed certificate will show browser warnings"
        echo "- For testing, you can accept the certificate manually"
        echo "- Use a proper certificate for production"
    fi
    
    echo -e "\n${BLUE}🔗 Next Steps:${NC}"
    echo "1. Update DNS records to point to this server"
    echo "2. Deploy the application services"
    echo "3. Test HTTPS connectivity"
    echo "4. Monitor certificate expiration"
}

# Run main function
main "$@"