# Deployment Infrastructure

This directory contains all deployment scripts, configurations, and infrastructure-as-code for the Intent-Based Trading Aggregator.

## Directory Structure

```
deployment/
├── scripts/              # Deployment scripts
│   ├── deploy.sh         # Main deployment script
│   ├── setup-ssl.sh      # SSL certificate setup
│   └── health-check.sh   # Post-deployment validation
├── config/               # Environment configurations
│   ├── production.env    # Production environment
│   ├── staging.env       # Staging environment
│   └── development.env   # Development environment
├── docker/               # Docker configurations
│   ├── production/       # Production Docker setup
│   ├── staging/         # Staging Docker setup
│   └── nginx/           # Nginx configurations
├── kubernetes/           # Kubernetes manifests
│   ├── base/            # Base configurations
│   ├── overlays/        # Environment-specific overlays
│   └── helm/            # Helm charts
├── terraform/            # Infrastructure as Code
│   ├── aws/             # AWS resources
│   ├── gcp/             # Google Cloud resources
│   └── modules/         # Reusable modules
├── monitoring/           # Monitoring configurations
│   ├── prometheus/      # Prometheus config
│   ├── grafana/         # Grafana dashboards
│   └── alerting/        # Alert rules
├── security/             # Security configurations
│   ├── policies/        # Security policies
│   ├── rbac/            # Role-based access control
│   └── secrets/         # Secret management
└── docs/                # Deployment documentation
    ├── runbooks/        # Operational runbooks
    ├── troubleshooting/ # Troubleshooting guides
    └── architecture/    # Architecture diagrams
```

## Quick Start

### Production Deployment

```bash
# 1. Configure environment
cp deployment/config/production.env.example deployment/config/production.env
# Edit production.env with your values

# 2. Deploy infrastructure
cd deployment/terraform/aws
terraform init && terraform apply

# 3. Deploy application
./deployment/scripts/deploy.sh production

# 4. Validate deployment
./deployment/scripts/health-check.sh production
```

### Staging Deployment

```bash
# Deploy to staging
./deployment/scripts/deploy.sh staging
```

## Prerequisites

- Docker 20.0+
- Docker Compose 2.0+
- Terraform 1.5+
- kubectl 1.25+
- Helm 3.10+
- AWS CLI 2.0+ (for AWS deployments)

## Environments

- **Development**: Local development with Docker Compose
- **Staging**: Pre-production testing environment  
- **Production**: Live production environment

## Security

All deployment configurations follow security best practices:
- Encrypted secrets management
- Network segmentation
- SSL/TLS encryption
- Role-based access control
- Regular security scanning

## Monitoring

Comprehensive monitoring stack includes:
- Prometheus for metrics collection
- Grafana for visualization
- Loki for log aggregation
- AlertManager for alerting
- Custom dashboards for business metrics

## Support

For deployment issues:
1. Check the [Troubleshooting Guide](docs/troubleshooting/README.md)
2. Review [Operational Runbooks](docs/runbooks/README.md)
3. Contact the infrastructure team