# Intent-Based Trading Aggregator - Operations Manual

Comprehensive guide for system operators, DevOps engineers, and site reliability engineers responsible for deploying, monitoring, and maintaining the Intent-Based Trading Aggregator in production.

## Table of Contents

- [Overview](#overview)
- [Production Deployment](#production-deployment)
- [Monitoring and Alerting](#monitoring-and-alerting)
- [Backup and Recovery](#backup-and-recovery)
- [Scaling Operations](#scaling-operations)
- [Troubleshooting](#troubleshooting)
- [Maintenance Procedures](#maintenance-procedures)
- [Security Operations](#security-operations)
- [Incident Response](#incident-response)
- [Runbooks](#runbooks)

## Overview

The Intent-Based Trading Aggregator is a distributed system running on Kubernetes with multiple components that require careful coordination and monitoring.

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Kubernetes    │    │   Databases     │
│                 │    │                 │    │                 │
│  • Nginx/ALB    │◄──►│  • Backend Pods │◄──►│  • PostgreSQL   │
│  • SSL Term.    │    │  • WebSocket    │    │  • Redis        │
│  • Rate Limit   │    │  • Monitoring   │    │  • Backups      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   External      │              │
         └──────────────►│   Services      │◄─────────────┘
                        │                 │
                        │  • Blockchain   │
                        │  • Monitoring   │
                        │  • Logging      │
                        └─────────────────┘
```

### Key Components

| Component | Purpose | Scaling | Recovery |
|-----------|---------|---------|----------|
| **Backend Relayer** | Intent ingestion | Horizontal | Stateless |
| **Backend Coordinator** | Bid coordination | Horizontal | Stateless |
| **WebSocket Server** | Real-time updates | Horizontal | Session-aware |
| **PostgreSQL** | Data persistence | Vertical | Backup-based |
| **Redis** | Caching/queuing | Vertical | Memory-based |
| **Smart Contracts** | Settlement | N/A | Immutable |

## Production Deployment

### Prerequisites Checklist

Before deploying to production, ensure:

- [ ] Infrastructure provisioned via Terraform
- [ ] Kubernetes cluster operational
- [ ] SSL certificates obtained and configured
- [ ] DNS records configured
- [ ] Monitoring stack deployed
- [ ] Secrets properly configured
- [ ] Backup systems operational
- [ ] Security policies applied

### Deployment Procedure

#### 1. Infrastructure Deployment

```bash
# Deploy AWS infrastructure
cd deployment/terraform/aws
terraform workspace select production
terraform plan -var-file="production.tfvars"
terraform apply -var-file="production.tfvars"

# Get cluster credentials
aws eks update-kubeconfig --region us-east-1 --name intendly-production-eks
```

#### 2. Kubernetes Setup

```bash
# Install essential controllers
kubectl apply -k deployment/kubernetes/controllers/

# Verify controllers are running
kubectl get pods -n kube-system
kubectl get pods -n cert-manager
kubectl get pods -n ingress-nginx
```

#### 3. Application Deployment

```bash
# Deploy secrets first
kubectl apply -k deployment/kubernetes/overlays/production/secrets/

# Deploy applications
kubectl apply -k deployment/kubernetes/overlays/production/

# Verify deployment
kubectl get pods -n intendly
kubectl get ingress -n intendly
```

#### 4. Smart Contract Deployment

```bash
# Deploy contracts to X Layer mainnet
./deployment/scripts/deploy-contracts.sh production true

# Verify deployment
cast call <CONTRACT_ADDRESS> "owner()(address)" --rpc-url https://xlayerrpc.okx.com
```

#### 5. Post-Deployment Validation

```bash
# Run comprehensive health checks
./deployment/scripts/health-check.sh production

# Verify all endpoints
curl -f https://api.intendly.xyz/health
curl -f https://app.intendly.xyz

# Check monitoring
curl -f https://monitoring.intendly.xyz/grafana/api/health
```

### Rollback Procedure

If deployment fails:

```bash
# Immediate rollback
kubectl rollout undo deployment/backend-relayer -n intendly
kubectl rollout undo deployment/backend-coordinator -n intendly
kubectl rollout undo deployment/websocket-server -n intendly

# Verify rollback
kubectl rollout status deployment/backend-relayer -n intendly
./deployment/scripts/health-check.sh production
```

## Monitoring and Alerting

### Monitoring Stack

#### Prometheus Configuration

Monitor these key metrics:

```yaml
# Critical Business Metrics
- intents_processed_total
- intents_settled_total  
- settlement_success_rate
- average_settlement_time
- trading_volume_usd
- active_solvers_count

# System Health Metrics
- up{job=~"backend-.*"}
- http_requests_total
- http_request_duration_seconds
- websocket_connections_active
- database_connections_active
- redis_connected_clients

# Infrastructure Metrics
- node_cpu_seconds_total
- node_memory_MemAvailable_bytes
- node_filesystem_free_bytes
- container_cpu_usage_seconds_total
- container_memory_working_set_bytes
```

#### Grafana Dashboards

Essential dashboards to monitor:

1. **System Overview**
   - Service health status
   - Request rates and errors
   - Response times
   - Resource utilization

2. **Business Metrics**
   - Intent processing rates
   - Settlement success rates
   - Trading volume
   - Solver performance

3. **Infrastructure**
   - Node health
   - Pod resource usage
   - Database performance
   - Network metrics

4. **Alerts**
   - Active alerts
   - Alert history
   - Escalation status

### Alert Configuration

#### Critical Alerts (Immediate Response)

```yaml
- ServiceDown: Any backend service down > 1 minute
- HighErrorRate: Error rate > 5% for 2 minutes
- DatabaseDown: PostgreSQL unreachable
- RedisDown: Redis cluster unreachable
- IntentProcessingStalled: No intents processed for 5 minutes
- BlockchainConnectionLost: RPC connection failed
```

#### Warning Alerts (Response within 15 minutes)

```yaml
- HighCPUUsage: CPU > 80% for 5 minutes
- HighMemoryUsage: Memory > 85% for 5 minutes
- DiskSpaceLow: Disk usage > 85%
- HighResponseTime: 95th percentile > 2 seconds
- LowSolverParticipation: < 3 active solvers
```

#### Info Alerts (Response within 1 hour)

```yaml
- LowTradingVolume: Volume < $1000/hour
- HighSlippageRate: Average slippage > 50 bps
- SolverPerformanceDegraded: Success rate < 95%
```

### Alert Routing

```yaml
# PagerDuty for critical alerts
critical_alerts:
  receiver: pagerduty
  group_interval: 30s
  repeat_interval: 5m

# Slack for warnings
warning_alerts:
  receiver: slack-warnings
  group_interval: 5m
  repeat_interval: 30m

# Email for info alerts  
info_alerts:
  receiver: email-team
  group_interval: 15m
  repeat_interval: 24h
```

## Backup and Recovery

### Database Backup Strategy

#### Automated Backups

```bash
# Daily full backups at 2 AM UTC
0 2 * * * /scripts/backup-database.sh full

# Hourly incremental backups during business hours
0 9-17 * * * /scripts/backup-database.sh incremental

# Weekly backup to cold storage
0 3 * * 0 /scripts/backup-database.sh archive
```

#### Backup Script

```bash
#!/bin/bash
# /scripts/backup-database.sh

DB_HOST="production-db.internal"
DB_NAME="intendly_production"
BACKUP_DIR="/backups/postgresql"
S3_BUCKET="intendly-production-backups"

# Create backup
BACKUP_FILE="${BACKUP_DIR}/$(date +%Y%m%d_%H%M%S)_${DB_NAME}.sql.gz"
pg_dump -h ${DB_HOST} -U ${DB_USER} ${DB_NAME} | gzip > ${BACKUP_FILE}

# Verify backup
if [[ $? -eq 0 ]]; then
    echo "Backup successful: ${BACKUP_FILE}"
    
    # Upload to S3
    aws s3 cp ${BACKUP_FILE} s3://${S3_BUCKET}/postgresql/
    
    # Cleanup old local backups (keep 7 days)
    find ${BACKUP_DIR} -name "*.sql.gz" -mtime +7 -delete
else
    echo "Backup failed!"
    exit 1
fi
```

#### Database Recovery

```bash
# Point-in-time recovery
pg_restore -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME}_new ${BACKUP_FILE}

# Verify data integrity
psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME}_new -c "SELECT COUNT(*) FROM intents;"

# Switch to restored database (requires downtime)
# 1. Stop application
kubectl scale deployment --replicas=0 -n intendly --all

# 2. Switch database
# Update connection strings and restart

# 3. Start application
kubectl scale deployment --replicas=3 -n intendly backend-relayer
```

### Redis Backup Strategy

Redis data is primarily cache and can be regenerated, but for faster recovery:

```bash
# Backup Redis AOF and RDB files
redis-cli --rdb /backups/redis/dump_$(date +%Y%m%d).rdb
cp /var/lib/redis/appendonly.aof /backups/redis/aof_$(date +%Y%m%d).aof
```

### Application State Backup

```bash
# Backup Kubernetes configurations
kubectl get all -o yaml -n intendly > backup_k8s_$(date +%Y%m%d).yaml

# Backup secrets (encrypted)
kubectl get secrets -o yaml -n intendly | gpg --encrypt > secrets_$(date +%Y%m%d).yaml.gpg
```

## Scaling Operations

### Horizontal Scaling

#### Backend Services

```bash
# Scale relayer based on load
kubectl scale deployment backend-relayer --replicas=5 -n intendly

# Scale coordinator for high bid volume
kubectl scale deployment backend-coordinator --replicas=3 -n intendly

# Scale WebSocket servers for more connections
kubectl scale deployment websocket-server --replicas=4 -n intendly
```

#### Auto-scaling Configuration

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-relayer-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend-relayer
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Vertical Scaling

#### Database Scaling

```bash
# Scale PostgreSQL instance
aws rds modify-db-instance \
  --db-instance-identifier intendly-production-postgres \
  --db-instance-class db.r5.2xlarge \
  --apply-immediately

# Monitor performance impact
watch -n 5 'aws rds describe-db-instances --db-instance-identifier intendly-production-postgres --query "DBInstances[0].DBInstanceStatus"'
```

#### Redis Scaling

```bash
# Scale Redis cluster
aws elasticache modify-replication-group \
  --replication-group-id intendly-production-redis \
  --node-type cache.r5.xlarge \
  --apply-immediately
```

### Node Scaling

```bash
# Scale EKS node group
aws eks update-nodegroup-config \
  --cluster-name intendly-production-eks \
  --nodegroup-name general \
  --scaling-config minSize=5,maxSize=20,desiredSize=8
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Service Not Responding

**Symptoms:**
- HTTP 503 errors
- Connection timeouts
- Health check failures

**Diagnosis:**
```bash
# Check pod status
kubectl get pods -n intendly

# Check pod logs
kubectl logs -f deployment/backend-relayer -n intendly

# Check resource usage
kubectl top pods -n intendly

# Check network connectivity
kubectl exec -it <pod-name> -n intendly -- curl http://backend-relayer-service:3001/health
```

**Solutions:**
```bash
# Restart deployment
kubectl rollout restart deployment/backend-relayer -n intendly

# Scale up if resource constrained
kubectl scale deployment backend-relayer --replicas=5 -n intendly

# Check for memory leaks
kubectl exec -it <pod-name> -n intendly -- cat /proc/meminfo
```

#### 2. Database Connection Issues

**Symptoms:**
- Connection pool exhausted
- Slow query performance
- Timeout errors

**Diagnosis:**
```bash
# Check active connections
psql -h ${DB_HOST} -c "SELECT count(*) FROM pg_stat_activity;"

# Check long-running queries
psql -h ${DB_HOST} -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"

# Check database metrics
aws rds describe-db-instances --db-instance-identifier intendly-production-postgres
```

**Solutions:**
```bash
# Kill long-running queries
psql -h ${DB_HOST} -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND (now() - pg_stat_activity.query_start) > interval '10 minutes';"

# Increase connection pool size
kubectl set env deployment/backend-relayer DB_POOL_MAX=20 -n intendly

# Scale database instance
aws rds modify-db-instance --db-instance-identifier intendly-production-postgres --db-instance-class db.r5.large
```

#### 3. WebSocket Connection Drops

**Symptoms:**
- Frequent reconnections
- Message delivery failures
- Client complaints about real-time updates

**Diagnosis:**
```bash
# Check WebSocket server logs
kubectl logs -f deployment/websocket-server -n intendly

# Check connection metrics
curl -s http://websocket-service:9090/metrics | grep websocket_connections

# Check load balancer configuration
kubectl describe ingress backend-ingress -n intendly
```

**Solutions:**
```bash
# Increase connection limits
kubectl set env deployment/websocket-server WS_MAX_CONNECTIONS=20000 -n intendly

# Configure session affinity
kubectl annotate ingress backend-ingress nginx.ingress.kubernetes.io/upstream-hash-by='$remote_addr'

# Scale WebSocket servers
kubectl scale deployment websocket-server --replicas=6 -n intendly
```

#### 4. High Memory Usage

**Symptoms:**
- Pod restarts due to OOMKill
- Slow performance
- Memory alerts firing

**Diagnosis:**
```bash
# Check memory usage
kubectl top pods -n intendly
kubectl describe pod <pod-name> -n intendly

# Check for memory leaks
kubectl exec -it <pod-name> -n intendly -- cat /proc/<pid>/status

# Analyze heap dumps (Node.js)
kubectl exec -it <pod-name> -n intendly -- node --inspect --heapsnapshot-signal=SIGUSR2 app.js
```

**Solutions:**
```bash
# Increase memory limits
kubectl patch deployment backend-relayer -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend-relayer","resources":{"limits":{"memory":"2Gi"}}}]}}}}' -n intendly

# Add memory profiling
kubectl set env deployment/backend-relayer NODE_OPTIONS="--max-old-space-size=1536" -n intendly

# Restart affected pods
kubectl delete pod -l app=backend-relayer -n intendly
```

### Performance Troubleshooting

#### Slow Response Times

1. **Check application metrics:**
   ```bash
   # Query Prometheus for response times
   curl -G 'http://prometheus:9090/api/v1/query' \
     --data-urlencode 'query=histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))'
   ```

2. **Analyze database performance:**
   ```sql
   -- Find slow queries
   SELECT query, calls, total_time, mean_time 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   ```

3. **Check Redis performance:**
   ```bash
   redis-cli --latency-history -i 1
   redis-cli info stats | grep ops
   ```

#### High Error Rates

1. **Analyze error patterns:**
   ```bash
   # Check error rates by endpoint
   kubectl logs deployment/backend-relayer -n intendly | grep "ERROR" | tail -100
   
   # Query error metrics
   curl -G 'http://prometheus:9090/api/v1/query' \
     --data-urlencode 'query=sum(rate(http_requests_total{status=~"5.."}[5m])) by (endpoint)'
   ```

2. **Check external dependencies:**
   ```bash
   # Test blockchain connectivity
   curl -X POST -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
     https://xlayerrpc.okx.com
   ```

## Maintenance Procedures

### Scheduled Maintenance

#### Database Maintenance

```bash
# Weekly maintenance (Sundays at 3 AM UTC)
#!/bin/bash
# /scripts/weekly-maintenance.sh

# 1. Update database statistics
psql -h ${DB_HOST} -c "ANALYZE;"

# 2. Vacuum old data
psql -h ${DB_HOST} -c "VACUUM VERBOSE;"

# 3. Reindex frequently updated tables
psql -h ${DB_HOST} -c "REINDEX TABLE intents;"

# 4. Clean up old logs
psql -h ${DB_HOST} -c "DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days';"

# 5. Update table statistics
psql -h ${DB_HOST} -c "UPDATE pg_stat_user_tables SET n_tup_ins=0, n_tup_upd=0, n_tup_del=0;"
```

#### Application Updates

```bash
# Rolling update procedure
#!/bin/bash
# /scripts/rolling-update.sh

DEPLOYMENT=$1
NEW_IMAGE=$2

# Update deployment
kubectl set image deployment/${DEPLOYMENT} ${DEPLOYMENT}=${NEW_IMAGE} -n intendly

# Wait for rollout
kubectl rollout status deployment/${DEPLOYMENT} -n intendly --timeout=300s

# Verify health
./deployment/scripts/health-check.sh production

# Rollback if health check fails
if [[ $? -ne 0 ]]; then
    echo "Health check failed, rolling back..."
    kubectl rollout undo deployment/${DEPLOYMENT} -n intendly
    exit 1
fi
```

#### Certificate Renewal

```bash
# Certificate renewal (automated via cert-manager)
# Verify certificate status
kubectl get certificates -n intendly

# Force renewal if needed
kubectl delete certificate api-tls-secret -n intendly
kubectl apply -k deployment/kubernetes/overlays/production/certificates/
```

### Configuration Updates

#### Environment Variables

```bash
# Update configuration
kubectl create configmap backend-config \
  --from-env-file=deployment/config/production.env \
  --dry-run=client -o yaml | kubectl apply -n intendly -f -

# Restart deployments to pick up changes
kubectl rollout restart deployment/backend-relayer -n intendly
kubectl rollout restart deployment/backend-coordinator -n intendly
```

#### Secrets Rotation

```bash
# Rotate database password
NEW_PASSWORD=$(openssl rand -base64 32)

# Update RDS password
aws rds modify-db-instance \
  --db-instance-identifier intendly-production-postgres \
  --master-user-password ${NEW_PASSWORD}

# Update Kubernetes secret
kubectl create secret generic database-secret \
  --from-literal=password=${NEW_PASSWORD} \
  --dry-run=client -o yaml | kubectl apply -n intendly -f -

# Restart applications
kubectl rollout restart deployment -n intendly --all
```

## Security Operations

### Security Monitoring

#### Log Analysis

```bash
# Monitor for suspicious activity
kubectl logs -f deployment/backend-relayer -n intendly | grep -E "(WARN|ERROR|401|403|429)"

# Check for brute force attacks
kubectl logs deployment/backend-relayer -n intendly | grep "429" | awk '{print $4}' | sort | uniq -c | sort -nr

# Monitor authentication failures
kubectl logs deployment/backend-relayer -n intendly | grep "Invalid signature" | tail -20
```

#### Vulnerability Scanning

```bash
# Scan container images
trivy image ghcr.io/intendly/intendly-backend:latest

# Scan Kubernetes configurations
kube-score score deployment/kubernetes/overlays/production/*.yaml

# Network security scanning
nmap -sS api.intendly.xyz
```

### Access Control

#### Kubernetes RBAC

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: intendly-operator
  namespace: intendly
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch", "update", "patch"]
```

#### Database Access

```sql
-- Create read-only monitoring user
CREATE USER monitoring_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE intendly TO monitoring_user;
GRANT USAGE ON SCHEMA public TO monitoring_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitoring_user;
```

### Incident Response

#### Security Incident Response Plan

1. **Detection**
   - Automated alerts
   - Manual discovery
   - Third-party notification

2. **Assessment**
   - Determine scope and impact
   - Identify affected systems
   - Classify incident severity

3. **Containment**
   - Immediately isolate affected systems
   - Preserve evidence
   - Prevent further damage

4. **Eradication**
   - Remove threats
   - Apply patches
   - Update security measures

5. **Recovery**
   - Restore services
   - Monitor for continued activity
   - Validate system integrity

6. **Lessons Learned**
   - Document incident
   - Update procedures
   - Improve monitoring

#### Emergency Procedures

##### Complete System Shutdown

```bash
# Emergency shutdown procedure
#!/bin/bash
# /scripts/emergency-shutdown.sh

echo "EMERGENCY SHUTDOWN INITIATED"

# 1. Scale down all applications
kubectl scale deployment --replicas=0 -n intendly --all

# 2. Stop ingress traffic
kubectl delete ingress --all -n intendly

# 3. Backup current state
kubectl get all -o yaml -n intendly > emergency_backup_$(date +%Y%m%d_%H%M%S).yaml

# 4. Notify team
curl -X POST ${SLACK_WEBHOOK} -d '{"text":"🚨 EMERGENCY SHUTDOWN ACTIVATED"}'

echo "System shutdown complete"
```

##### Rapid Recovery

```bash
# Emergency recovery procedure
#!/bin/bash
# /scripts/emergency-recovery.sh

echo "EMERGENCY RECOVERY INITIATED"

# 1. Restore from known good state
kubectl apply -f last_known_good_config.yaml

# 2. Scale up critical services
kubectl scale deployment backend-relayer --replicas=3 -n intendly
kubectl scale deployment websocket-server --replicas=2 -n intendly

# 3. Restore ingress
kubectl apply -k deployment/kubernetes/overlays/production/ingress/

# 4. Verify health
./deployment/scripts/health-check.sh production

# 5. Notify team
curl -X POST ${SLACK_WEBHOOK} -d '{"text":"✅ Emergency recovery completed"}'
```

## Runbooks

### Daily Operations

#### Morning Checklist (9 AM UTC)

- [ ] Check overnight alerts and resolve any issues
- [ ] Review system performance metrics
- [ ] Verify backup completion status
- [ ] Check trading volume and activity
- [ ] Monitor solver performance
- [ ] Review error rates and investigate anomalies
- [ ] Check certificate expiration status
- [ ] Verify all services are healthy

#### End of Day Review (6 PM UTC)

- [ ] Review daily metrics and trends
- [ ] Check for any pending alerts
- [ ] Verify backup schedules for overnight
- [ ] Review capacity planning metrics
- [ ] Document any issues or changes
- [ ] Prepare for any scheduled maintenance

### Weekly Operations

#### Weekly Review (Mondays)

- [ ] Analyze weekly performance trends
- [ ] Review and rotate logs
- [ ] Check for security updates
- [ ] Review capacity and scaling needs
- [ ] Update monitoring thresholds if needed
- [ ] Conduct backup recovery tests
- [ ] Review incident reports and update procedures

### Monthly Operations

#### Monthly Review

- [ ] Security audit and vulnerability assessment
- [ ] Capacity planning review
- [ ] Cost optimization analysis
- [ ] Performance benchmarking
- [ ] Disaster recovery testing
- [ ] Team access review and cleanup
- [ ] Documentation updates
- [ ] Vendor security assessments

## Support and Escalation

### Contact Information

| Role | Primary | Secondary | Escalation |
|------|---------|-----------|------------|
| **On-Call Engineer** | +1-555-0101 | +1-555-0102 | CTO |
| **Database Admin** | dba@intendly.xyz | +1-555-0103 | VP Engineering |
| **Security Team** | security@intendly.xyz | +1-555-0104 | CISO |
| **DevOps Lead** | devops@intendly.xyz | +1-555-0105 | VP Engineering |

### Escalation Matrix

| Severity | Response Time | Escalation Time | Who to Contact |
|----------|---------------|-----------------|----------------|
| **Critical** | 15 minutes | 30 minutes | On-Call → Team Lead → CTO |
| **High** | 1 hour | 2 hours | On-Call → Team Lead |
| **Medium** | 4 hours | 8 hours | On-Call |
| **Low** | 24 hours | 48 hours | Team Lead |

### Communication Channels

- **Slack**: #production-alerts, #devops, #security
- **PagerDuty**: For critical alerts and escalation
- **Email**: For non-urgent communications
- **Phone**: For emergency escalation

---

*This operations manual should be reviewed and updated quarterly to ensure accuracy and completeness.*

**Last Updated**: 2024-01-15  
**Version**: 1.0.0  
**Next Review**: 2024-04-15