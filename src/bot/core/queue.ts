// src/bot/core/queue.ts
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { MemeJobData, MemeJobResult } from '../types/types.js';

const QUEUE_NAME = 'meme-generation';

// Create a new Redis connection for BullMQ, reusing the logic from cache.ts
const getRedisConnection = () => {
    const upstashUrl = process.env.UPSTASH_REDIS_URL;
    const localRedisUrl = process.env.REDIS_URL;

    const connection = upstashUrl ? new Redis(upstashUrl, { maxRetriesPerRequest: null }) :
        localRedisUrl ? new Redis(localRedisUrl, { maxRetriesPerRequest: null }) :
            new Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD,
                maxRetriesPerRequest: null
            });

    connection.on('error', (err) => {
        console.error('❌ BullMQ Redis connection error:', err);
    });

    return connection;
};

const connection = getRedisConnection();

// Create a new queue
export const memeQueue = new Queue<MemeJobData, MemeJobResult>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
        attempts: 2, // Retry a job 2 times if it fails
        backoff: {
            type: 'exponential',
            delay: 5000, // Start with a 5-second delay
        },
        removeOnComplete: true, // Automatically remove completed jobs
        removeOnFail: { count: 100 }, // Keep last 100 failed jobs
    },
});

console.log('✅ BullMQ Queue initialized');

// Graceful shutdown
const gracefulShutdown = async () => {
    console.log('Shutting down BullMQ queue...');
    await memeQueue.close();
    await connection.quit();
    process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
