# syntax=docker/dockerfile:1

# Build stage - use regular Node.js image for building
FROM node:20-slim as builder

WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Production stage - use Playwright image for runtime
FROM mcr.microsoft.com/playwright:v1.54.1-noble

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN groupadd -r botuser && useradd -r -g botuser -G audio,video botuser \
    && mkdir -p /home/botuser/Downloads \
    && chown -R botuser:botuser /home/botuser \
    && chown -R botuser:botuser /app

# Switch to non-root user
USER botuser

# Environment variables
ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV NODE_ENV=production

# Expose port
EXPOSE 3300

# Health check
HEALTHCHECK --interval=60s --timeout=15s --start-period=15s --retries=5 \
    CMD curl -f http://localhost:3300/health || exit 1

# Start the application
CMD ["node", "dist/bot/bot.js"]