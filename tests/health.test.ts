// tests/health.test.ts

import { jest } from '@jest/globals';
import type { QueueHealth } from './types/types.ts';


const mockGetQueueHealth = jest.fn<() => Promise<QueueHealth>>();
const mockGetBrowser = jest.fn();
const mockGetPopularMemes = jest.fn<() => Promise<unknown[]>>();
const mockQueueMetrics = {
    jobsProcessed: 100,
    jobsFailed: 5,
    averageProcessingTime: 250,
    errors: [
        { error: 'Rate limit exceeded', timestamp: Date.now() },
        { error: 'Some other error', timestamp: Date.now() }
    ]
};

// Mock modules before imports
jest.unstable_mockModule('../src/bot/core/queue.js', () => ({
    memeQueue: {},
    queueMetrics: mockQueueMetrics,
    getQueueHealth: mockGetQueueHealth,
}));

jest.unstable_mockModule('../src/bot/core/browser.js', () => ({
    getBrowser: mockGetBrowser,
}));

jest.unstable_mockModule('../src/bot/core/cache.js', () => ({
    memeCache: {
        getPopularMemes: mockGetPopularMemes,
    },
}));

// Import after mocking
const {
    getSystemHealth,
    isSystemHealthy,
    isSystemReady,
    getHealthMetrics
} = await import('../src/bot/core/health.js');

describe('Health System', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Set up default healthy state
        mockGetQueueHealth.mockResolvedValue({
            status: 'healthy',
            queue: {
                waiting: 2,
                active: 1,
                failed: 0,
                completed: 100
            },
            redis: {
                connected: true,
                lastPing: '5ms'
            }
        });

        mockGetBrowser.mockReturnValue({ connected: true });
        mockGetPopularMemes.mockResolvedValue([]);
    });

    describe('getSystemHealth', () => {
        it('should return healthy status when all components are healthy', async () => {
            const health = await getSystemHealth();

            expect(health.status).toBe('healthy');
            expect(health.components.queue.status).toBe('healthy');
            expect(health.components.redis.status).toBe('healthy');
            expect(health.components.browser.status).toBe('healthy');
            expect(health.components.cache.status).toBe('healthy');
            expect(health.timestamp).toBeDefined();
            expect(health.uptime).toBeGreaterThanOrEqual(0);
        });

        it('should return degraded status when one component is unhealthy', async () => {
            // Make browser unhealthy
            mockGetBrowser.mockReturnValue(null);

            const health = await getSystemHealth();

            expect(health.status).toBe('degraded');
            expect(health.components.browser.status).toBe('unhealthy');
            expect(health.components.browser.available).toBe(false);
        });

        it('should return unhealthy status when multiple components are unhealthy', async () => {
            // Make multiple components unhealthy
            mockGetBrowser.mockReturnValue(null);
            mockGetPopularMemes.mockRejectedValue(new Error('Cache connection failed'));

            const health = await getSystemHealth();

            expect(health.status).toBe('unhealthy');
            expect(health.components.browser.status).toBe('unhealthy');
            expect(health.components.cache.status).toBe('unhealthy');
            expect(health.components.cache.error).toBe('Cache connection failed');
        });

        it('should include queue metrics in health report', async () => {
            mockGetQueueHealth.mockResolvedValue({
                status: 'healthy',
                queue: {
                    waiting: 5,
                    active: 3,
                    failed: 2,
                    completed: 150
                },
                redis: {
                    connected: true,
                    lastPing: '3ms'
                }
            });

            const health = await getSystemHealth();

            expect(health.components.queue.waiting).toBe(5);
            expect(health.components.queue.active).toBe(3);
            expect(health.components.queue.failed).toBe(2);
            expect(health.components.queue.completed).toBe(150);
            expect(health.components.queue.metrics).toEqual(mockQueueMetrics);
        });

        it('should calculate performance metrics correctly', async () => {
            const health = await getSystemHealth();

            expect(health.performance.memory).toBeDefined();
            expect(health.performance.averageJobTime).toBe(250);
            expect(health.performance.successRate).toBeCloseTo(95.24, 1); // 100/(100+5) * 100
            expect(health.performance.rateLimitHits).toBe(1);
        });

        it('should handle queue health check failure', async () => {
            mockGetQueueHealth.mockRejectedValue(new Error('Queue check failed'));

            const health = await getSystemHealth();

            expect(health.components.queue.status).toBe('unhealthy');
            expect(health.status).toBe('degraded');
        });

        it('should handle browser health check failure', async () => {
            mockGetBrowser.mockImplementation(() => {
                throw new Error('Browser not available');
            });

            const health = await getSystemHealth();

            expect(health.components.browser.status).toBe('unhealthy');
            expect(health.components.browser.error).toBe('Browser not available');
        });

        it('should handle cache health check failure', async () => {
            mockGetPopularMemes.mockRejectedValue(new Error('Redis connection timeout'));

            const health = await getSystemHealth();

            expect(health.components.cache.status).toBe('unhealthy');
            expect(health.components.cache.connected).toBe(false);
            expect(health.components.cache.error).toBe('Redis connection timeout');
        });

        it('should calculate success rate as 100% when no jobs processed', async () => {
            mockQueueMetrics.jobsProcessed = 0;
            mockQueueMetrics.jobsFailed = 0;

            const health = await getSystemHealth();

            expect(health.performance.successRate).toBe(100);

            // Reset for other tests
            mockQueueMetrics.jobsProcessed = 100;
            mockQueueMetrics.jobsFailed = 5;
        });
    });

    describe('isSystemHealthy', () => {
        it('should return true when system status is healthy', async () => {
            const healthy = await isSystemHealthy();

            expect(healthy).toBe(true);
        });

        it('should return true when system status is degraded', async () => {
            mockGetBrowser.mockReturnValue(null);

            const healthy = await isSystemHealthy();

            expect(healthy).toBe(true); // degraded is still considered "healthy enough"
        });

        it('should return false when system status is unhealthy', async () => {
            mockGetBrowser.mockReturnValue(null);
            mockGetPopularMemes.mockRejectedValue(new Error('Cache failed'));

            const healthy = await isSystemHealthy();

            expect(healthy).toBe(false);
        });

        it('should return false when health check throws error', async () => {
            mockGetQueueHealth.mockRejectedValue(new Error('Critical failure'));
            mockGetBrowser.mockImplementation(() => {
                throw new Error('Browser error');
            });
            mockGetPopularMemes.mockRejectedValue(new Error('Cache error'));

            const healthy = await isSystemHealthy();

            expect(healthy).toBe(false);
        });
    });

    describe('isSystemReady', () => {
        it('should return true when all components are healthy', async () => {
            const ready = await isSystemReady();

            expect(ready).toBe(true);
        });

        it('should return false when system is degraded', async () => {
            mockGetBrowser.mockReturnValue(null);

            const ready = await isSystemReady();

            expect(ready).toBe(false); // readiness is stricter than liveness
        });

        it('should return false when system is unhealthy', async () => {
            mockGetBrowser.mockReturnValue(null);
            mockGetPopularMemes.mockRejectedValue(new Error('Cache failed'));

            const ready = await isSystemReady();

            expect(ready).toBe(false);
        });

        it('should return false when readiness check throws error', async () => {
            mockGetQueueHealth.mockRejectedValue(new Error('Queue check failed'));

            const ready = await isSystemReady();

            expect(ready).toBe(false);
        });
    });

    describe('getHealthMetrics', () => {
        it('should return Prometheus-compatible metrics', async () => {
            const metrics = await getHealthMetrics();

            expect(metrics).toHaveProperty('memestream_uptime_seconds');
            expect(metrics).toHaveProperty('memestream_memory_usage_bytes');
            expect(metrics).toHaveProperty('memestream_queue_waiting_jobs');
            expect(metrics).toHaveProperty('memestream_jobs_processed_total');
            expect(metrics).toHaveProperty('memestream_system_healthy');
        });

        it('should return correct metric values', async () => {
            mockGetQueueHealth.mockResolvedValue({
                status: 'healthy',
                queue: {
                    waiting: 5,
                    active: 2,
                    failed: 1,
                    completed: 200
                },
                redis: {
                    connected: true,
                    lastPing: '2ms'
                }
            });

            const metrics = await getHealthMetrics();

            expect(metrics.memestream_queue_waiting_jobs).toBe(5);
            expect(metrics.memestream_queue_active_jobs).toBe(2);
            expect(metrics.memestream_queue_failed_jobs).toBe(1);
            expect(metrics.memestream_jobs_processed_total).toBe(100);
            expect(metrics.memestream_job_processing_time_avg_ms).toBe(250);
            expect(metrics.memestream_system_healthy).toBe(1);
        });

        it('should return 0 for unhealthy components', async () => {
            mockGetBrowser.mockReturnValue(null);
            mockGetPopularMemes.mockRejectedValue(new Error('Cache failed'));

            const metrics = await getHealthMetrics();

            expect(metrics.memestream_browser_healthy).toBe(0);
            expect(metrics.memestream_cache_healthy).toBe(0);
            expect(metrics.memestream_system_healthy).toBe(0);
        });

        it('should include memory metrics', async () => {
            const metrics = await getHealthMetrics();

            expect(metrics.memestream_memory_usage_bytes).toBeGreaterThan(0);
            expect(metrics.memestream_memory_total_bytes).toBeGreaterThan(0);
            expect(metrics.memestream_memory_usage_bytes).toBeLessThanOrEqual(
                metrics.memestream_memory_total_bytes
            );
        });
    });
});