# Intent-Based Trading Aggregator - Terraform Outputs
# Output values for AWS infrastructure deployment

# =============================================================================
# VPC OUTPUTS
# =============================================================================

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnets" {
  description = "List of IDs of private subnets"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "List of IDs of public subnets"
  value       = module.vpc.public_subnets
}

output "intra_subnets" {
  description = "List of IDs of intra subnets"
  value       = module.vpc.intra_subnets
}

output "nat_gateway_ids" {
  description = "List of IDs of NAT Gateways"
  value       = module.vpc.natgw_ids
}

# =============================================================================
# EKS OUTPUTS
# =============================================================================

output "cluster_id" {
  description = "EKS cluster ID"
  value       = module.eks.cluster_name
}

output "cluster_arn" {
  description = "EKS cluster ARN"
  value       = module.eks.cluster_arn
}

output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "cluster_version" {
  description = "The Kubernetes version for the EKS cluster"
  value       = module.eks.cluster_version
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "cluster_oidc_issuer_url" {
  description = "The URL on the EKS cluster OIDC Issuer"
  value       = module.eks.cluster_oidc_issuer_url
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "node_groups" {
  description = "EKS node groups information"
  value = {
    for k, v in module.eks.eks_managed_node_groups : k => {
      arn                    = v.node_group_arn
      status                 = v.node_group_status
      capacity_type          = v.capacity_type
      instance_types         = v.instance_types
      scaling_config         = v.scaling_config
      remote_access          = v.remote_access
    }
  }
}

# =============================================================================
# RDS OUTPUTS
# =============================================================================

output "db_instance_id" {
  description = "RDS instance ID"
  value       = aws_db_instance.main.id
}

output "db_instance_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.main.arn
}

output "db_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "db_instance_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "db_instance_name" {
  description = "RDS instance database name"
  value       = aws_db_instance.main.db_name
}

output "db_instance_username" {
  description = "RDS instance master username"
  value       = aws_db_instance.main.username
  sensitive   = true
}

output "db_subnet_group_id" {
  description = "RDS subnet group ID"
  value       = aws_db_subnet_group.main.id
}

output "db_parameter_group_id" {
  description = "RDS parameter group ID"
  value       = aws_db_parameter_group.main.id
}

# =============================================================================
# REDIS OUTPUTS
# =============================================================================

output "redis_cluster_id" {
  description = "ElastiCache Redis cluster ID"
  value       = aws_elasticache_replication_group.main.id
}

output "redis_cluster_arn" {
  description = "ElastiCache Redis cluster ARN"
  value       = aws_elasticache_replication_group.main.arn
}

output "redis_primary_endpoint" {
  description = "Address of the Redis primary endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  sensitive   = true
}

output "redis_configuration_endpoint" {
  description = "Address of the Redis configuration endpoint"
  value       = aws_elasticache_replication_group.main.configuration_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.main.port
}

output "redis_subnet_group_name" {
  description = "Redis subnet group name"
  value       = aws_elasticache_subnet_group.main.name
}

# =============================================================================
# SECURITY OUTPUTS
# =============================================================================

output "kms_key_id" {
  description = "KMS key ID"
  value       = aws_kms_key.main.key_id
}

output "kms_key_arn" {
  description = "KMS key ARN"
  value       = aws_kms_key.main.arn
}

output "kms_alias_arn" {
  description = "KMS alias ARN"
  value       = aws_kms_alias.main.arn
}

output "secrets_manager_database_arn" {
  description = "Database secrets ARN in Secrets Manager"
  value       = aws_secretsmanager_secret.database.arn
}

output "secrets_manager_redis_arn" {
  description = "Redis secrets ARN in Secrets Manager"
  value       = aws_secretsmanager_secret.redis.arn
}

# =============================================================================
# LOAD BALANCER OUTPUTS
# =============================================================================

output "alb_arn" {
  description = "Application Load Balancer ARN"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Application Load Balancer zone ID"
  value       = aws_lb.main.zone_id
}

output "alb_security_group_id" {
  description = "Application Load Balancer security group ID"
  value       = aws_security_group.alb.id
}

# =============================================================================
# SECURITY GROUP OUTPUTS
# =============================================================================

output "security_groups" {
  description = "Security group IDs"
  value = {
    eks_cluster  = aws_security_group.eks_cluster.id
    rds         = aws_security_group.rds.id
    elasticache = aws_security_group.elasticache.id
    alb         = aws_security_group.alb.id
  }
}

# =============================================================================
# IAM OUTPUTS
# =============================================================================

output "iam_roles" {
  description = "IAM role ARNs"
  value = {
    eks_cluster           = aws_iam_role.eks_cluster.arn
    eks_node_group       = aws_iam_role.eks_node_group.arn
    rds_monitoring       = aws_iam_role.rds_monitoring.arn
  }
}

# =============================================================================
# CLOUDWATCH OUTPUTS
# =============================================================================

output "cloudwatch_log_groups" {
  description = "CloudWatch log group names"
  value = {
    eks_cluster   = aws_cloudwatch_log_group.eks_cluster.name
    application   = aws_cloudwatch_log_group.application.name
  }
}

# =============================================================================
# S3 OUTPUTS
# =============================================================================

output "s3_bucket_alb_logs" {
  description = "S3 bucket for ALB logs"
  value       = aws_s3_bucket.alb_logs.bucket
}

# =============================================================================
# CONNECTION STRINGS (SENSITIVE)
# =============================================================================

output "database_connection_string" {
  description = "Database connection string"
  value       = "postgresql://${aws_db_instance.main.username}:${random_password.db_password.result}@${aws_db_instance.main.endpoint}:${aws_db_instance.main.port}/${aws_db_instance.main.db_name}"
  sensitive   = true
}

output "redis_connection_string" {
  description = "Redis connection string"
  value       = "redis://:${random_password.redis_password.result}@${aws_elasticache_replication_group.main.configuration_endpoint_address}:${aws_elasticache_replication_group.main.port}"
  sensitive   = true
}

# =============================================================================
# ENVIRONMENT-SPECIFIC OUTPUTS
# =============================================================================

output "environment_info" {
  description = "Environment-specific information"
  value = {
    environment = var.environment
    region      = var.aws_region
    project     = var.project_name
    owner       = var.owner
  }
}

# =============================================================================
# KUBERNETES CONFIG
# =============================================================================

output "kubectl_config" {
  description = "kubectl config command"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

# =============================================================================
# MONITORING ENDPOINTS
# =============================================================================

output "monitoring_endpoints" {
  description = "Monitoring and management endpoints"
  value = {
    alb_dns_name = aws_lb.main.dns_name
    api_endpoint = "https://${var.api_subdomain}.${var.domain_name}"
    monitoring_endpoint = "https://${var.monitoring_subdomain}.${var.domain_name}"
  }
}

# =============================================================================
# COST OPTIMIZATION INFO
# =============================================================================

output "cost_optimization" {
  description = "Cost optimization information"
  value = {
    spot_instances_enabled = var.enable_spot_instances
    autoscaling_enabled   = var.enable_autoscaling
    environment_type      = var.environment
    estimated_monthly_cost = "Check AWS Cost Explorer for current costs"
  }
}

# =============================================================================
# DEPLOYMENT INFORMATION
# =============================================================================

output "deployment_info" {
  description = "Information needed for application deployment"
  value = {
    cluster_name          = module.eks.cluster_name
    cluster_endpoint      = module.eks.cluster_endpoint
    namespace            = "intendly"
    secrets_manager_db   = aws_secretsmanager_secret.database.name
    secrets_manager_redis = aws_secretsmanager_secret.redis.name
    kms_key_id           = aws_kms_key.main.key_id
    log_group_name       = aws_cloudwatch_log_group.application.name
  }
  sensitive = true
}

# =============================================================================
# NEXT STEPS
# =============================================================================

output "next_steps" {
  description = "Next steps after infrastructure deployment"
  value = [
    "1. Configure kubectl: aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}",
    "2. Install AWS Load Balancer Controller: kubectl apply -k deployment/kubernetes/controllers/aws-load-balancer-controller/",
    "3. Install External DNS: kubectl apply -k deployment/kubernetes/controllers/external-dns/",
    "4. Install Cert Manager: kubectl apply -k deployment/kubernetes/controllers/cert-manager/",
    "5. Deploy application: kubectl apply -k deployment/kubernetes/overlays/${var.environment}/",
    "6. Configure monitoring: kubectl apply -k deployment/kubernetes/monitoring/",
    "7. Set up DNS records for ${var.api_subdomain}.${var.domain_name} and ${var.monitoring_subdomain}.${var.domain_name}",
    "8. Run health checks: ./deployment/scripts/health-check.sh ${var.environment}"
  ]
}