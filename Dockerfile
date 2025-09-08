# syntax=docker/dockerfile:1

# Build stage
FROM node:20-slim as builder
WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Final stage
FROM mcr.microsoft.com/playwright:v1.54.1-noble

# Create a non-root user and group first
RUN groupadd -r botuser && useradd -r -g botuser -G audio,video botuser \
    && mkdir -p /home/botuser/Downloads

# Create app directory and set ownership before setting WORKDIR
RUN mkdir -p /app && chown -R botuser:botuser /app

# Set the working directory
WORKDIR /app

# Switch to the non-root user
USER botuser

# Copy package files (owner is already botuser due to chown above)
COPY package*.json ./

# Install only production dependencies as the non-root user
RUN --mount=type=cache,target=/home/botuser/.npm \
    npm ci --only=production && \
    npm cache clean --force

# Switch back to root to install system packages
USER root

# Copy built application and other files
COPY --from=builder --chown=botuser:botuser /app/dist ./dist
COPY --chown=botuser:botuser ecosystem.config.cjs ./
COPY --chown=botuser:botuser start.sh ./

# Install Redis
RUN apt-get update && apt-get install -y redis-server && rm -rf /var/lib/apt/lists/*

# Configure Redis for persistence (AOF)
RUN echo "appendonly yes" >> /etc/redis/redis.conf

# Make the start script executable
RUN chmod +x start.sh

# Environment variables
ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV NODE_ENV=production

# Expose ports
EXPOSE 3300
EXPOSE 6379

# Health check
HEALTHCHECK --interval=60s --timeout=15s --start-period=15s --retries=5 \
    CMD curl -f http://localhost:3300/health || exit 1

# Start the application using the script (will run as root, but script drops to botuser)
CMD ["./start.sh"]
