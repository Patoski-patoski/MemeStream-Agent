// Define types for mock functions to avoid 'never' errors
export type SystemHealth = {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    components: {
        queue: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            waiting: number;
            active: number;
            failed: number;
            completed: number;
            metrics: {
                jobsProcessed: number;
                jobsFailed: number;
                averageProcessingTime: number;
                errors: any[];
            };
        };
        redis: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            connected: boolean;
            ping: string;
        };
        browser: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            available: boolean;
        };
        cache: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            connected: boolean;
        };
    };
    performance: {
        memory: {
            rss: number;
            heapTotal: number;
            heapUsed: number;
            external: number;
            arrayBuffers: number;
        };
        averageJobTime: number;
        successRate: number;
        rateLimitHits: number;
    };
};

export type HealthMetrics = {
    [key: string]: number;
};


export type QueueHealth = {
    status: string;
    queue: {
        waiting: number;
        active: number;
        failed: number;
        completed: number;
    };
    redis: {
        connected: boolean;
        lastPing: string;
    };
};