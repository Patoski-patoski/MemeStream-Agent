// src/bot/core/queue.ts
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { MemeJobData, MemeJobResult } from '../types/types.js';

const QUEUE_NAME = 'meme-generation';

// Enhanced Redis connection with better configuration and monitoring
const getRedisConnection = () => {
    const upstashUrl = process.env.UPSTASH_REDIS_URL;
    const localRedisUrl = process.env.REDIS_URL;
    
    // Common Redis options optimized for BullMQ
    const commonOptions = {
        maxRetriesPerRequest: null, // Let BullMQ handle retries
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxLoadingTimeout: 60000, // 60 seconds
        connectionName: 'memestream-queue',
        // Connection pool settings
        family: 4, // Use IPv4
        keepAlive: 30000, // 30 seconds
        commandTimeout: 30000, // 30 seconds
        lazyConnect: true, // Don't connect immediately
        // Memory optimizations
        db: parseInt(process.env.REDIS_DB || '0'),
    };

    let connection: Redis;
    
    if (upstashUrl) {
        console.log('🌐 Using Upstash Redis connection');
        connection = new Redis(upstashUrl, commonOptions);
    } else if (localRedisUrl) {
        console.log('🔗 Using Redis URL connection');
        connection = new Redis(localRedisUrl, commonOptions);
    } else {
        console.log('⚙️ Using manual Redis configuration');
        connection = new Redis({
            ...commonOptions,
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
        });
    }

    // Enhanced connection event handlers
    connection.on('connect', () => {
        console.log('✅ BullMQ Redis connected');
    });
    
    connection.on('ready', () => {
        console.log('🚀 BullMQ Redis ready for operations');
    });
    
    connection.on('error', (err) => {
        console.error('❌ BullMQ Redis connection error:', err.message);
    });
    
    connection.on('close', () => {
        console.warn('⚠️ BullMQ Redis connection closed');
    });
    
    connection.on('reconnecting', (delay: number) => {
        console.log(`🔄 BullMQ Redis reconnecting in ${delay}ms`);
    });

    // Connection health monitoring
    const healthCheck = setInterval(async () => {
        try {
            if (connection.status === 'ready') {
                await connection.ping();
            }
        } catch (error) {
            console.error('❌ Redis health check failed:', error);
        }
    }, 30000); // Check every 30 seconds

    // Clear health check on connection close
    connection.on('end', () => {
        clearInterval(healthCheck);
    });

    return connection;
};

const connection = getRedisConnection();

// Enhanced job options with different retry strategies
const getJobOptions = (jobType: 'blank' | 'full') => {
    const baseOptions = {
        removeOnComplete: 10, // Keep last 10 completed jobs for monitoring
        removeOnFail: { count: 100 }, // Keep last 100 failed jobs
    };

    if (jobType === 'blank') {
        return {
            ...baseOptions,
            attempts: 3, // More retries for quick operations
            backoff: {
                type: 'exponential' as const,
                delay: 2000, // Faster retry for blank templates
            },
            priority: 10, // Higher priority for quick requests
        };
    } else {
        return {
            ...baseOptions,
            attempts: 2, // Fewer retries for resource-intensive operations
            backoff: {
                type: 'exponential' as const,
                delay: 10000, // Longer delay for full searches
            },
            priority: 5, // Lower priority
            delay: 1000, // Small delay to batch similar requests
        };
    }
};

// Create a new queue with enhanced configuration
export const memeQueue = new Queue<MemeJobData, MemeJobResult>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: 10,
        removeOnFail: { count: 100 },
    },
});

// Rate limiting functionality
const rateLimitMap = new Map<number, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per user

export const checkRateLimit = (chatId: number): { allowed: boolean; resetTime?: number } => {
    const now = Date.now();
    const userLimit = rateLimitMap.get(chatId);
    
    if (!userLimit || now > userLimit.resetTime) {
        // Reset or create new rate limit window
        rateLimitMap.set(chatId, {
            count: 1,
            resetTime: now + RATE_LIMIT_WINDOW
        });
        return { allowed: true };
    }
    
    if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
        return { allowed: false, resetTime: userLimit.resetTime };
    }
    
    // Increment count
    userLimit.count++;
    return { allowed: true };
};

// Enhanced job addition with priority and rate limiting
export const addMemeJob = async (
    jobName: string,
    jobData: MemeJobData,
    options?: {
        priority?: number;
        delay?: number;
        bypassRateLimit?: boolean;
    }
) => {
    // Check rate limit unless bypassed
    if (!options?.bypassRateLimit) {
        const rateLimitCheck = checkRateLimit(jobData.chatId);
        if (!rateLimitCheck.allowed) {
            const waitTime = Math.ceil((rateLimitCheck.resetTime! - Date.now()) / 1000);
            throw new Error(`Rate limit exceeded. Try again in ${waitTime} seconds.`);
        }
    }
    
    // Get job-specific options
    const jobOptions = getJobOptions(jobData.jobType);
    
    // Merge with custom options
    const finalOptions = {
        ...jobOptions,
        ...options,
        // Add priority boost for premium users (if implemented later)
        priority: options?.priority ?? jobOptions.priority
    };
    
    return await memeQueue.add(jobName, jobData, finalOptions);
};

// Cleanup rate limit map periodically
setInterval(() => {
    const now = Date.now();
    for (const [chatId, limit] of rateLimitMap.entries()) {
        if (now > limit.resetTime) {
            rateLimitMap.delete(chatId);
        }
    }
}, RATE_LIMIT_WINDOW); // Clean up every minute

// Job metrics and monitoring
export const queueMetrics = {
    jobsProcessed: 0,
    jobsFailed: 0,
    averageProcessingTime: 0,
    lastProcessedAt: null as Date | null,
    errors: [] as Array<{ timestamp: Date; error: string; jobType?: string }>
};

// Enhanced logging and metrics
memeQueue.on('completed', (job) => {
    queueMetrics.jobsProcessed++;
    queueMetrics.lastProcessedAt = new Date();
    const processingTime = job.finishedOn! - job.processedOn!;
    queueMetrics.averageProcessingTime = 
        (queueMetrics.averageProcessingTime + processingTime) / 2;
    
    console.log(`✅ Job ${job.id} (${job.data.jobType}) completed in ${processingTime}ms`);
});

memeQueue.on('failed', (job, err) => {
    queueMetrics.jobsFailed++;
    const errorInfo = {
        timestamp: new Date(),
        error: err.message,
        jobType: job?.data?.jobType
    };
    queueMetrics.errors.push(errorInfo);
    
    // Keep only last 50 errors
    if (queueMetrics.errors.length > 50) {
        queueMetrics.errors.shift();
    }
    
    console.error(`❌ Job ${job?.id} (${job?.data?.jobType}) failed:`, err.message);
});

memeQueue.on('stalled', (jobId) => {
    console.warn(`⚠️ Job ${jobId} stalled (worker may have crashed)`);
});

// Health check function
export const getQueueHealth = async () => {
    try {
        const waiting = await memeQueue.getWaiting();
        const active = await memeQueue.getActive();
        const failed = await memeQueue.getFailed();
        const completed = await memeQueue.getCompleted();
        
        return {
            status: 'healthy',
            queue: {
                waiting: waiting.length,
                active: active.length,
                failed: failed.length,
                completed: completed.length
            },
            metrics: queueMetrics,
            redis: {
                connected: connection.status === 'ready',
                lastPing: await connection.ping()
            }
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

console.log('✅ BullMQ Queue initialized with monitoring');

// Enhanced graceful shutdown with timeout and proper cleanup
const gracefulShutdown = async (signal?: string) => {
    console.log(`\n🛑 Received ${signal || 'shutdown'} signal. Starting graceful shutdown...`);
    
    const shutdownTimeout = setTimeout(() => {
        console.error('⚠️ Graceful shutdown timeout! Forcing exit...');
        process.exit(1);
    }, 30000); // 30 second timeout
    
    try {
        // 1. Stop accepting new jobs
        console.log('📝 Stopping queue from accepting new jobs...');
        await memeQueue.pause();
        
        // 2. Wait for active jobs to complete (with timeout)
        console.log('⏳ Waiting for active jobs to complete...');
        const activeJobs = await memeQueue.getActive();
        if (activeJobs.length > 0) {
            console.log(`📊 Waiting for ${activeJobs.length} active jobs to finish...`);
            
            // Wait up to 20 seconds for jobs to complete
            const maxWait = 20000;
            const startTime = Date.now();
            
            while (Date.now() - startTime < maxWait) {
                const stillActive = await memeQueue.getActive();
                if (stillActive.length === 0) break;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            const finalActive = await memeQueue.getActive();
            if (finalActive.length > 0) {
                console.warn(`⚠️ ${finalActive.length} jobs still active after timeout`);
            }
        }
        
        // 3. Close the queue
        console.log('🔒 Closing BullMQ queue...');
        await memeQueue.close();
        
        // 4. Close Redis connection
        console.log('📡 Closing Redis connection...');
        await connection.quit();
        
        // 5. Clear rate limiting map
        rateLimitMap.clear();
        
        console.log('✅ Graceful shutdown completed successfully');
        clearTimeout(shutdownTimeout);
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        clearTimeout(shutdownTimeout);
        process.exit(1);
    }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});
