# syntax=docker/dockerfile:1

# Multi-stage build for optimal size
FROM node:20-slim as builder

WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install dependencies with cache mount for faster rebuilds
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Remove dev dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm prune --production

# Final stage - use minimal base image
FROM node:20-slim

# Install only essential system dependencies for Playwright
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt/lists \
    # Clean up any existing state
    rm -rf /var/lib/apt/lists/* && \
    rm -f /var/lib/apt/lists/lock && \
    rm -f /var/cache/apt/archives/lock && \
    rm -f /var/lib/dpkg/lock* && \
    # Update package lists and install dependencies
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    # Essential for Playwright browsers
    libnss3 \
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
    libgconf-2-4 \
    # Additional dependencies that might be missing
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    # Minimal font support
    fonts-liberation \
    # For health checks
    curl \
    ca-certificates \
    # Clean up
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app

# Copy built application and production dependencies from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Install only chromium with cache mount (matches CI)
RUN --mount=type=cache,target=/root/.cache/ms-playwright \
    npx playwright install chromium --with-deps

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