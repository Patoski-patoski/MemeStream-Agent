# Use Node.js 18 with Playwright dependencies pre-installed
FROM mcr.microsoft.com/playwright:v1.40.0-focal

# Set working directory
WORKDIR /app

# Install additional system dependencies for better stability
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    libappindicator3-1 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for better security
RUN groupadd -r botuser && useradd -r -g botuser -G audio,video botuser \
    && mkdir -p /home/botuser/Downloads \
    && chown -R botuser:botuser /home/botuser \
    && chown -R botuser:botuser /app

# Switch to non-root user
USER botuser

# Copy package files first (better caching)
COPY package*.json tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Invalidate cache from this point forward
ARG CACHE_BUST=1

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Set memory limit for Node.js (important for containers)
ENV NODE_OPTIONS="--max-old-space-size=1024"



# Expose port
EXPOSE 3300

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3300/health || exit 1

# Start the application
CMD ["node", "dist/bot/bot.js"]
