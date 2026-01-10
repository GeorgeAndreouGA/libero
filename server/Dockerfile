# ===========================
# PRODUCTION MULTI-STAGE DOCKERFILE
# ===========================
# Optimized for security, size, and performance
# Runs as non-root user with minimal dependencies

# ===========================
# Stage 1: Builder
# ===========================
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript application
RUN npm run build

# ===========================
# Stage 2: Production Dependencies
# ===========================
FROM node:20-alpine AS deps

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

# ===========================
# Stage 3: Production Runtime
# ===========================
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling, tzdata for timezone support, and mysql-client for backups
# Using community repository for MySQL 8 compatible client
RUN apk add --no-cache dumb-init tzdata && \
    apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community mysql-client

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Copy production dependencies
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copy package.json for metadata
COPY --chown=nestjs:nodejs package*.json ./

# Create uploads and backups directories with proper permissions
RUN mkdir -p /app/uploads/bets /app/backups && \
    chown -R nestjs:nodejs /app/uploads /app/backups

# Set environment
ENV NODE_ENV=production \
    PORT=3000

# Expose port
EXPOSE 3000

# Switch to non-root user
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/main.js"]
