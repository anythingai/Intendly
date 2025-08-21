# Intent-Based Trading Aggregator - Terraform Variables
# Variable definitions for AWS infrastructure deployment

# =============================================================================
# PROJECT CONFIGURATION
# =============================================================================

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "intendly"
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "owner" {
  description = "Owner of the resources"
  type        = string
  default     = "intendly-team"
}

# =============================================================================
# AWS CONFIGURATION
# =============================================================================

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

# =============================================================================
# NETWORK CONFIGURATION
# =============================================================================

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "List of CIDR blocks that can access the Amazon EKS public API server endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# =============================================================================
# EKS CONFIGURATION
# =============================================================================

variable "kubernetes_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.28"
}

variable "node_instance_types" {
  description = "List of instance types for EKS node groups"
  type        = list(string)
  default     = ["t3.medium", "t3.large"]
}

variable "spot_instance_types" {
  description = "List of instance types for spot node groups"
  type        = list(string)
  default     = ["t3.medium", "t3.large", "t3.xlarge"]
}

variable "node_group_min_size" {
  description = "Minimum number of nodes in node group"
  type        = number
  default     = 1
}

variable "node_group_max_size" {
  description = "Maximum number of nodes in node group"
  type        = number
  default     = 10
}

variable "node_group_desired_size" {
  description = "Desired number of nodes in node group"
  type        = number
  default     = 3
}

variable "additional_aws_auth_users" {
  description = "Additional IAM users to add to the aws-auth configmap"
  type = list(object({
    userarn  = string
    username = string
    groups   = list(string)
  }))
  default = []
}

# =============================================================================
# RDS CONFIGURATION
# =============================================================================

variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "14.9"
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
  validation {
    condition = can(regex("^db\\.", var.rds_instance_class))
    error_message = "RDS instance class must start with 'db.'."
  }
}

variable "rds_allocated_storage" {
  description = "Initial storage allocation for RDS instance (GB)"
  type        = number
  default     = 20
  validation {
    condition     = var.rds_allocated_storage >= 20
    error_message = "RDS allocated storage must be at least 20 GB."
  }
}

variable "rds_max_allocated_storage" {
  description = "Maximum storage allocation for RDS instance (GB)"
  type        = number
  default     = 100
}

variable "database_name" {
  description = "Name of the database"
  type        = string
  default     = "intendly"
}

variable "database_user" {
  description = "Database master username"
  type        = string
  default     = "intendly"
}

variable "backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
  validation {
    condition     = var.backup_retention_period >= 1 && var.backup_retention_period <= 35
    error_message = "Backup retention period must be between 1 and 35 days."
  }
}

# =============================================================================
# REDIS CONFIGURATION
# =============================================================================

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "7.0"
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
  validation {
    condition = can(regex("^cache\\.", var.redis_node_type))
    error_message = "Redis node type must start with 'cache.'."
  }
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes in the Redis cluster"
  type        = number
  default     = 1
  validation {
    condition     = var.redis_num_cache_nodes >= 1 && var.redis_num_cache_nodes <= 6
    error_message = "Number of Redis cache nodes must be between 1 and 6."
  }
}

variable "redis_snapshot_retention_limit" {
  description = "Number of days to retain Redis snapshots"
  type        = number
  default     = 5
  validation {
    condition     = var.redis_snapshot_retention_limit >= 0 && var.redis_snapshot_retention_limit <= 35
    error_message = "Redis snapshot retention limit must be between 0 and 35 days."
  }
}

# =============================================================================
# MONITORING AND LOGGING
# =============================================================================

variable "log_retention_in_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 14
  validation {
    condition = contains([
      1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653
    ], var.log_retention_in_days)
    error_message = "Log retention must be a valid CloudWatch log retention value."
  }
}

variable "enable_container_insights" {
  description = "Enable CloudWatch Container Insights for EKS cluster"
  type        = bool
  default     = true
}

# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================

variable "enable_vpc_flow_logs" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = true
}

variable "enable_guardduty" {
  description = "Enable AWS GuardDuty"
  type        = bool
  default     = true
}

variable "enable_config" {
  description = "Enable AWS Config"
  type        = bool
  default     = false
}

variable "enable_cloudtrail" {
  description = "Enable AWS CloudTrail"
  type        = bool
  default     = true
}

# =============================================================================
# COST OPTIMIZATION
# =============================================================================

variable "enable_spot_instances" {
  description = "Enable spot instances for non-critical workloads"
  type        = bool
  default     = true
}

variable "enable_autoscaling" {
  description = "Enable cluster autoscaling"
  type        = bool
  default     = true
}

# =============================================================================
# FEATURE FLAGS
# =============================================================================

variable "enable_alb_controller" {
  description = "Enable AWS Load Balancer Controller"
  type        = bool
  default     = true
}

variable "enable_external_dns" {
  description = "Enable External DNS controller"
  type        = bool
  default     = true
}

variable "enable_cert_manager" {
  description = "Enable Cert Manager for SSL certificates"
  type        = bool
  default     = true
}

variable "enable_metrics_server" {
  description = "Enable Kubernetes Metrics Server"
  type        = bool
  default     = true
}

variable "enable_cluster_autoscaler" {
  description = "Enable Cluster Autoscaler"
  type        = bool
  default     = true
}

# =============================================================================
# DOMAIN AND SSL
# =============================================================================

variable "domain_name" {
  description = "Primary domain name for the application"
  type        = string
  default     = "intendly.xyz"
}

variable "api_subdomain" {
  description = "Subdomain for API endpoints"
  type        = string
  default     = "api"
}

variable "monitoring_subdomain" {
  description = "Subdomain for monitoring dashboards"
  type        = string
  default     = "monitoring"
}

# =============================================================================
# BACKUP AND DISASTER RECOVERY
# =============================================================================

variable "enable_cross_region_backup" {
  description = "Enable cross-region backup for critical resources"
  type        = bool
  default     = false
}

variable "backup_schedule" {
  description = "Cron expression for backup schedule"
  type        = string
  default     = "cron(0 2 * * ? *)"  # Daily at 2 AM UTC
}

# =============================================================================
# PERFORMANCE TUNING
# =============================================================================

variable "db_performance_insights_enabled" {
  description = "Enable Performance Insights for RDS"
  type        = bool
  default     = true
}

variable "redis_parameter_group_family" {
  description = "Redis parameter group family"
  type        = string
  default     = "redis7.x"
}

# =============================================================================
# ENVIRONMENT-SPECIFIC OVERRIDES
# =============================================================================

variable "environment_config" {
  description = "Environment-specific configuration overrides"
  type = object({
    node_group_min_size     = optional(number)
    node_group_max_size     = optional(number)
    node_group_desired_size = optional(number)
    rds_instance_class     = optional(string)
    redis_node_type        = optional(string)
    backup_retention_period = optional(number)
    log_retention_in_days  = optional(number)
  })
  default = {}
}

# =============================================================================
# TAGS
# =============================================================================

variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# =============================================================================
# LOCALS FOR COMPUTED VALUES
# =============================================================================

locals {
  # Environment-specific defaults
  environment_defaults = {
    development = {
      node_group_min_size     = 1
      node_group_max_size     = 3
      node_group_desired_size = 1
      rds_instance_class     = "db.t3.micro"
      redis_node_type        = "cache.t3.micro"
      backup_retention_period = 1
      log_retention_in_days  = 7
    }
    staging = {
      node_group_min_size     = 2
      node_group_max_size     = 5
      node_group_desired_size = 2
      rds_instance_class     = "db.t3.small"
      redis_node_type        = "cache.t3.small"
      backup_retention_period = 7
      log_retention_in_days  = 14
    }
    production = {
      node_group_min_size     = 3
      node_group_max_size     = 20
      node_group_desired_size = 5
      rds_instance_class     = "db.r5.large"
      redis_node_type        = "cache.r5.large"
      backup_retention_period = 30
      log_retention_in_days  = 30
    }
  }

  # Merge environment defaults with user overrides
  effective_config = merge(
    local.environment_defaults[var.environment],
    var.environment_config
  )
}