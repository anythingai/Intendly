# Intent-Based Trading Aggregator Backend
# Multi-stage Docker build for Node.js/TypeScript application

# =============================================================================
# BASE IMAGE
# =============================================================================

FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S backend -u 1001

# =============================================================================
# DEPENDENCIES STAGE
# =============================================================================

FROM base AS dependencies

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci --include=dev

# =============================================================================
# BUILD STAGE
# =============================================================================

FROM dependencies AS build

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies
RUN npm ci --only=production && npm cache clean --force

# =============================================================================
# DEVELOPMENT STAGE
# =============================================================================

FROM base AS development

# Copy package files
COPY package*.json ./

# Install all dependencies including dev
RUN npm ci

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs && chown -R backend:nodejs logs

# Switch to non-root user
USER backend

# Expose ports
EXPOSE 3001 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start development server with watch mode
CMD ["dumb-init", "npm", "run", "dev"]

# =============================================================================
# PRODUCTION STAGE
# =============================================================================

FROM base AS production

# Copy built application from build stage
COPY --from=build --chown=backend:nodejs /app/dist ./dist
COPY --from=build --chown=backend:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=backend:nodejs /app/package*.json ./

# Create logs directory
RUN mkdir -p logs && chown -R backend:nodejs logs

# Switch to non-root user
USER backend

# Expose ports
EXPOSE 3001 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start production server
CMD ["dumb-init", "node", "dist/relayer/index.js"]

# =============================================================================
# METADATA
# =============================================================================

LABEL maintainer="Intent Trading Team"
LABEL version="0.1.0"
LABEL description="Backend services for Intent-Based Trading Aggregator"