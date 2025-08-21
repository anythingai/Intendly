# Deployment Guide

This guide covers deploying the Intent-Based Trading Aggregator across different environments.

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL 14+
- Redis 7+
- Foundry (for contracts)

## Environment Setup

### Local Development

1. **Clone Repository**
   ```bash
   git clone https://github.com/yourorg/intent-based-trading-aggregator.git
   cd intent-based-trading-aggregator
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start Services**
   ```bash
   # Start databases
   docker-compose up -d postgres redis
   
   # Run migrations
   npm run db:migrate
   
   # Start all services
   npm run dev
   ```

### Docker Development

```bash
# Build and start all services
docker-compose up --build

# Or with detached mode
docker-compose up -d --build
```

## Smart Contract Deployment

### X Layer Testnet

1. **Setup Environment**
   ```bash
   cd contracts
   cp .env.example .env
   # Configure PRIVATE_KEY, RPC_URL, etc.
   ```

2. **Deploy Contracts**
   ```bash
   forge script script/Deploy.s.sol \
     --rpc-url xlayer_testnet \
     --broadcast \
     --verify
   ```

3. **Verify Deployment**
   ```bash
   forge script script/Verify.s.sol \
     --rpc-url xlayer_testnet
   ```

### X Layer Mainnet

```bash
forge script script/Deploy.s.sol \
  --rpc-url xlayer \
  --broadcast \
  --verify \
  --slow
```

## Backend Services

### Production Configuration

**Environment Variables** (`.env.production`):
```bash
NODE_ENV=production
API_PORT=3001
WS_PORT=3002

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/intendly
REDIS_URL=redis://redis:6379

# Blockchain
CHAIN_ID=196
RPC_URL=https://xlayerrpc.okx.com
SETTLEMENT_CONTRACT_ADDRESS=0x...

# Security
JWT_SECRET=your-super-secure-jwt-secret
API_RATE_LIMIT_MAX=1000

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
```

### Docker Production

**Dockerfile**:
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build
EXPOSE 3001 3002
CMD ["npm", "start"]
```

**docker-compose.prod.yml**:
```yaml
version: '3.8'
services:
  backend:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    ports:
      - "3001:3001"
      - "3002:3002"
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    
  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=intendly
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    
volumes:
  postgres_data:
```

## Frontend Deployment

### Vercel (Recommended)

1. **Connect Repository**
   - Import project in Vercel dashboard
   - Select `web` directory as root

2. **Environment Variables**
   ```bash
   NEXT_PUBLIC_CHAIN_ID=196
   NEXT_PUBLIC_API_URL=https://api.intendly.xyz
   NEXT_PUBLIC_WS_URL=wss://ws.intendly.xyz
   NEXT_PUBLIC_SETTLEMENT_CONTRACT=0x...
   ```

3. **Build Settings**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

### Static Export

```bash
# Build static export
npm run build
npm run export

# Deploy to any static hosting
rsync -av out/ user@server:/var/www/intendly/
```

## Infrastructure

### AWS Deployment

**ECS Task Definition**:
```json
{
  "family": "intendly-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "your-registry/intendly-backend:latest",
      "portMappings": [
        {"containerPort": 3001, "protocol": "tcp"},
        {"containerPort": 3002, "protocol": "tcp"}
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:ssm:..."}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/intendly",
          "awslogs-region": "us-east-1"
        }
      }
    }
  ]
}
```

### Load Balancer Configuration

**nginx.conf**:
```nginx
upstream backend {
    server backend:3001;
}

upstream websocket {
    server backend:3002;
}

server {
    listen 80;
    server_name api.intendly.xyz;
    
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /stream {
        proxy_pass http://websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Database

### Migrations

```bash
# Run migrations
npm run db:migrate

# Rollback migration
npm run db:rollback

# Create new migration
npm run db:migrate:create add_solver_metrics
```

### Backup Strategy

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_${DATE}.sql
aws s3 cp backup_${DATE}.sql s3://intendly-backups/
```

## Monitoring

### Health Checks

```bash
# API Health
curl https://api.intendly.xyz/health

# Database Health
psql $DATABASE_URL -c "SELECT 1"

# Redis Health  
redis-cli -u $REDIS_URL ping
```

### Metrics Collection

**Prometheus Configuration**:
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'intendly-backend'
    static_configs:
      - targets: ['backend:9090']
    scrape_interval: 5s
    metrics_path: /metrics
```

### Alerting Rules

```yaml
groups:
  - name: intendly
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          
      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
```

## Security

### SSL/TLS

```bash
# Let's Encrypt with Certbot
certbot --nginx -d api.intendly.xyz -d ws.intendly.xyz
```

### Firewall Rules

```bash
# Allow HTTP/HTTPS
ufw allow 80
ufw allow 443

# Allow SSH (if needed)
ufw allow 22

# Database (internal only)
ufw allow from 10.0.0.0/8 to any port 5432
```

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.scale.yml
version: '3.8'
services:
  backend:
    deploy:
      replicas: 3
    environment:
      - REDIS_URL=redis://redis-cluster:6379
      
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - backend
```

### Database Scaling

```bash
# Read replicas
DATABASE_READ_URL=postgresql://readonly:pass@postgres-read:5432/intendly

# Connection pooling
DATABASE_POOL_MAX=20
DATABASE_POOL_MIN=5
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   lsof -i :3001
   kill -9 <PID>
   ```

2. **Database Connection**
   ```bash
   psql $DATABASE_URL -c "\l"
   ```

3. **Redis Connection**
   ```bash
   redis-cli -u $REDIS_URL info
   ```

### Log Analysis

```bash
# Container logs
docker-compose logs -f backend

# System logs
journalctl -u intendly-backend -f

# Application logs
tail -f /var/log/intendly/app.log
```

## Rollback Strategy

1. **Database Rollback**
   ```bash
   npm run db:rollback
   ```

2. **Container Rollback**
   ```bash
   docker-compose down
   docker-compose pull
   docker-compose up -d
   ```

3. **Frontend Rollback**
   - Revert in Vercel dashboard
   - Or deploy previous build

---

*For production support, contact the DevOps team.*