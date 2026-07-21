# ==============================================================================
# CLOUDMON BACKEND DOCKERFILE (Production-Hardened Multi-Stage Build)
# ==============================================================================

# --- Stage 1: Build stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependency catalogs
COPY package*.json ./
RUN npm ci

# Copy sources and compile TypeScript
COPY . .
RUN npm run build

# --- Stage 2: Production runtime stage ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built code from builder
COPY --from=builder /app/dist ./dist

# Assign low-privilege ownership to built-in 'node' user
RUN chown -R node:node /app
USER node

EXPOSE 5000

# Health check using default alpine wget tool
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "dist/index.js"]
