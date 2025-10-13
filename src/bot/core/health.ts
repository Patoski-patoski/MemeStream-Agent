// src/bot/core/health.ts
import { memeQueue, queueMetrics, getQueueHealth } from './queue.js';
import { memeCache } from './cache.js';
import { getBrowser } from './browser.js';

export interface SystemHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    components: {
        queue: {
            status: 'healthy' | 'unhealthy';
            waiting: number;
            active: number;
            failed: number;
            completed: number;
            metrics: typeof queueMetrics;
        };
        redis: {
            status: 'healthy' | 'unhealthy';
            connected: boolean;
            ping?: string;
            error?: string;
        };
        browser: {
            status: 'healthy' | 'unhealthy';
            available: boolean;
            error?: string;
        };
        cache: {
            status: 'healthy' | 'unhealthy';
            connected: boolean;
            error?: string;
        };
    };
    performance: {
        memory: NodeJS.MemoryUsage;
        averageJobTime: number;
        successRate: number;
        rateLimitHits: number;
    };
}

export const getSystemHealth = async (): Promise<SystemHealth> => {
    const startTime = Date.now();
    const uptime = process.uptime();
    
    // Check queue health
    let queueHealth;
    try {
        queueHealth = await getQueueHealth();
    } catch (error) {
        queueHealth = {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }

    // Check browser health
    let browserHealth;
    try {
        const browser = getBrowser();
        browserHealth = {
            status: browser ? 'healthy' as const : 'unhealthy' as const,
            available: !!browser
        };
    } catch (error) {
        browserHealth = {
            status: 'unhealthy' as const,
            available: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }

    // Check cache health
    let cacheHealth;
    try {
        // Try a simple operation to test cache connectivity
        await memeCache.getPopularMemes();
        cacheHealth = {
            status: 'healthy' as const,
            connected: true
        };
    } catch (error) {
        cacheHealth = {
            status: 'unhealthy' as const,
            connected: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }

    // Calculate performance metrics
    const memory = process.memoryUsage();
    const totalJobs = queueMetrics.jobsProcessed + queueMetrics.jobsFailed;
    const successRate = totalJobs > 0 ? (queueMetrics.jobsProcessed / totalJobs) * 100 : 100;

    // Determine overall system status
    const components = [queueHealth.status, browserHealth.status, cacheHealth.status];
    const unhealthyCount = components.filter(status => status === 'unhealthy').length;
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount === 0) {
        overallStatus = 'healthy';
    } else if (unhealthyCount === 1) {
        overallStatus = 'degraded';
    } else {
        overallStatus = 'unhealthy';
    }

    const health: SystemHealth = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime,
        components: {
            queue: {
                status: queueHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
                waiting: queueHealth.queue?.waiting || 0,
                active: queueHealth.queue?.active || 0,
                failed: queueHealth.queue?.failed || 0,
                completed: queueHealth.queue?.completed || 0,
                metrics: queueMetrics
            },
            redis: {
                status: queueHealth.redis?.connected ? 'healthy' : 'unhealthy',
                connected: queueHealth.redis?.connected || false,
                ping: queueHealth.redis?.lastPing,
                error: queueHealth.error
            },
            browser: browserHealth,
            cache: cacheHealth
        },
        performance: {
            memory,
            averageJobTime: queueMetrics.averageProcessingTime,
            successRate,
            rateLimitHits: queueMetrics.errors.filter(e => 
                e.error.includes('Rate limit')).length
        }
    };

    return health;
};

// Health check endpoint that can be used by load balancers/monitoring
export const isSystemHealthy = async (): Promise<boolean> => {
    try {
        const health = await getSystemHealth();
        return health.status !== 'unhealthy';
    } catch (error) {
        console.error('Health check failed:', error);
        return false;
    }
};

// Readiness check (more strict - all components must be healthy)
export const isSystemReady = async (): Promise<boolean> => {
    try {
        const health = await getSystemHealth();
        return health.status === 'healthy';
    } catch (error) {
        console.error('Readiness check failed:', error);
        return false;
    }
};

// Export health metrics for Prometheus/monitoring systems
export const getHealthMetrics = async () => {
    const health = await getSystemHealth();
    
    return {
        // System metrics
        'memestream_uptime_seconds': health.uptime,
        'memestream_memory_usage_bytes': health.performance.memory.heapUsed,
        'memestream_memory_total_bytes': health.performance.memory.heapTotal,
        
        // Queue metrics
        'memestream_queue_waiting_jobs': health.components.queue.waiting,
        'memestream_queue_active_jobs': health.components.queue.active,
        'memestream_queue_failed_jobs': health.components.queue.failed,
        'memestream_queue_completed_jobs': health.components.queue.completed,
        'memestream_jobs_processed_total': health.components.queue.metrics.jobsProcessed,
        'memestream_jobs_failed_total': health.components.queue.metrics.jobsFailed,
        'memestream_job_processing_time_avg_ms': health.performance.averageJobTime,
        'memestream_job_success_rate_percent': health.performance.successRate,
        
        // Component status (1 = healthy, 0 = unhealthy)
        'memestream_queue_healthy': health.components.queue.status === 'healthy' ? 1 : 0,
        'memestream_redis_healthy': health.components.redis.status === 'healthy' ? 1 : 0,
        'memestream_browser_healthy': health.components.browser.status === 'healthy' ? 1 : 0,
        'memestream_cache_healthy': health.components.cache.status === 'healthy' ? 1 : 0,
        
        // Overall system status
        'memestream_system_healthy': health.status === 'healthy' ? 1 : 0,
    };
};
