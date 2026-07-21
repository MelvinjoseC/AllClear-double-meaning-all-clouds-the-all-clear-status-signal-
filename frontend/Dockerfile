# ==============================================================================
# CLOUDMON FRONTEND DOCKERFILE (Production-Hardened Multi-Stage Build)
# ==============================================================================

# --- Stage 1: Dependency & Base Stage ---
FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# --- Stage 2: Development Stage ---
FROM base AS development

EXPOSE 5173

CMD ["npm", "run", "dev"]

# --- Stage 3: Production Builder Stage ---
FROM base AS builder

RUN npm run build

# --- Stage 4: Production Web Server Stage (Nginx) ---
FROM nginx:1.25-alpine AS production

# Copy built frontend assets to Nginx static content directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Inject custom Nginx fallback configuration for single-page routing (SPA)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
