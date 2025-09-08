#!/bin/sh
set -e

# Start Redis in the background
redis-server /etc/redis/redis.conf --daemonize yes

# Wait for Redis to start
until redis-cli ping > /dev/null 2>&1; do
  echo "Waiting for Redis to start..."
  sleep 1
done
echo "Redis started."

# Execute the main command as botuser
exec su botuser -c "npm start"
