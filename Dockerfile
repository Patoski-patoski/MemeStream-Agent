# syntax=docker/dockerfile:1

# Multi-stage build for optimal size
FROM node:20-slim as builder

WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Final stage - use Ubuntu LTS for better package stability
FROM ubuntu:22.04

# Install Node.js 20 and system dependencies in one layer
RUN apt-get update && \
    apt-get install -y curl ca-certificates gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    # Install Playwright dependencies
    apt-get install -y --no-install-recommends \
    libnss3 \
    libnspr4 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libgtk-3-0 \
    libasound2 \
    libxss1 \
    fonts-liberation \
    libappindicator3-1 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxtst6 \
    libatspi2.0-0 \
    libcairo-gobject2 \
    libgdk-pixbuf2.0-0 \
    libpangocairo-1.0-0 \
    # Clean up
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app

# Copy built application and production dependencies from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Install only chromium
RUN npx playwright install chromium --with-deps

# Create non-root user
RUN groupadd -r botuser && useradd -r -g botuser -G audio,video botuser \
    && mkdir -p /home/botuser/Downloads \
    && chown -R botuser:botuser /home/botuser \
    && chown -R botuser:botuser /app

USER botuser

# Environment variables
ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV NODE_ENV=production

EXPOSE 3300

# Health check
HEALTHCHECK --interval=60s --timeout=15s --start-period=15s --retries=5 \
    CMD curl -f http://localhost:3300/health || exit 1

CMD ["node", "dist/bot/bot.js"]