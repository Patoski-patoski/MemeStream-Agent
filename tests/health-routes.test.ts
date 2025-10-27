// tests/health-routes.test.ts

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

import type { SystemHealth, HealthMetrics } from './types/types.js';

// Create mock functions

const mockGetSystemHealth: jest.Mock<() => Promise<SystemHealth>> = jest.fn();
const mockIsSystemHealthy: jest.Mock<() => Promise<boolean>> = jest.fn();
const mockIsSystemReady: jest.Mock<() => Promise<boolean>> = jest.fn();
const mockGetHealthMetrics: jest.Mock<() => Promise<HealthMetrics>> = jest.fn();

// Mock the health module
jest.unstable_mockModule('../src/bot/core/health.js', () => ({
    getSystemHealth: mockGetSystemHealth,
    isSystemHealthy: mockIsSystemHealthy,
    isSystemReady: mockIsSystemReady,
    getHealthMetrics: mockGetHealthMetrics,
}));

// Import routes after mocking
const healthRoutes = (await import('../src/health-routes.js')).default;

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api', healthRoutes);

const mockHealthySystem = {
    status: 'healthy' as const,
    timestamp: '2025-10-26T12:00:00.000Z',
    uptime: 3600,
    components: {
        queue: {
            status: 'healthy' as const,
            waiting: 2,
            active: 1,
            failed: 0,
            completed: 100,
            metrics: {
                jobsProcessed: 100,
                jobsFailed: 5,
                averageProcessingTime: 250,
                errors: []
            }
        },
        redis: {
            status: 'healthy' as const,
            connected: true,
            ping: '5ms'
        },
        browser: {
            status: 'healthy' as const,
            available: true
        },
        cache: {
            status: 'healthy' as const,
            connected: true
        }
    },
    performance: {
        memory: {
            rss: 100000000,
            heapTotal: 50000000,
            heapUsed: 30000000,
            external: 1000000,
            arrayBuffers: 500000
        },
        averageJobTime: 250,
        successRate: 95.24,
        rateLimitHits: 1
    }
};

describe('Health Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Set up default healthy responses
        mockIsSystemHealthy.mockResolvedValue(true);
        mockIsSystemReady.mockResolvedValue(true);
        mockGetSystemHealth.mockResolvedValue(mockHealthySystem);
    });

    describe('GET /api/health', () => {
        it('should return 200 when system is healthy', async () => {
            const response = await request(app).get('/api/health');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                status: 'OK',
                timestamp: expect.any(String)
            });
            expect(mockIsSystemHealthy).toHaveBeenCalledTimes(1);
        });

        it('should return 503 when system is unhealthy', async () => {
            mockIsSystemHealthy.mockResolvedValue(false);

            const response = await request(app).get('/api/health');

            expect(response.status).toBe(503);
            expect(response.body).toEqual({
                status: 'Service Unavailable',
                timestamp: expect.any(String)
            });
        });

        it('should return 503 when health check throws error', async () => {
            mockIsSystemHealthy.mockRejectedValue(new Error('Health check failed'));

            const response = await request(app).get('/api/health');

            expect(response.status).toBe(503);
            expect(response.body).toEqual({
                status: 'Service Unavailable',
                error: 'Health check failed',
                timestamp: expect.any(String)
            });
        });
    });

    describe('GET /api/ready', () => {
        it('should return 200 when system is ready', async () => {
            const response = await request(app).get('/api/ready');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                status: 'Ready',
                timestamp: expect.any(String)
            });
            expect(mockIsSystemReady).toHaveBeenCalledTimes(1);
        });

        it('should return 503 when system is not ready', async () => {
            mockIsSystemReady.mockResolvedValue(false);

            const response = await request(app).get('/api/ready');

            expect(response.status).toBe(503);
            expect(response.body).toEqual({
                status: 'Not Ready',
                timestamp: expect.any(String)
            });
        });

        it('should return 503 when readiness check throws error', async () => {
            mockIsSystemReady.mockRejectedValue(new Error('Readiness check failed'));

            const response = await request(app).get('/api/ready');

            expect(response.status).toBe(503);
            expect(response.body).toEqual({
                status: 'Not Ready',
                error: 'Readiness check failed',
                timestamp: expect.any(String)
            });
        });
    });

    describe('GET /api/health/detailed', () => {
        it('should return detailed health information', async () => {
            const response = await request(app).get('/api/health/detailed');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockHealthySystem);
            expect(mockGetSystemHealth).toHaveBeenCalledTimes(1);
        });

        it('should return 503 for unhealthy system', async () => {
            const unhealthySystem = {
                ...mockHealthySystem,
                status: 'unhealthy' as const
            };
            mockGetSystemHealth.mockResolvedValue(unhealthySystem);

            const response = await request(app).get('/api/health/detailed');

            expect(response.status).toBe(503);
            expect(response.body).toEqual(unhealthySystem);
        });

        it('should return 200 for degraded system', async () => {
            const degradedSystem = {
                ...mockHealthySystem,
                status: 'degraded' as const
            };
            mockGetSystemHealth.mockResolvedValue(degradedSystem);

            const response = await request(app).get('/api/health/detailed');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(degradedSystem);
        });

        it('should return 500 when health check throws error', async () => {
            mockGetSystemHealth.mockRejectedValue(new Error('Database connection lost'));

            const response = await request(app).get('/api/health/detailed');

            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                status: 'error',
                error: 'Database connection lost',
                timestamp: expect.any(String)
            });
        });
    });

    describe('GET /api/metrics', () => {
        const mockMetrics = {
            memestream_uptime_seconds: 3600,
            memestream_memory_usage_bytes: 30000000,
            memestream_queue_waiting_jobs: 2,
            memestream_jobs_processed_total: 100,
            memestream_system_healthy: 1
        };

        it('should return Prometheus-formatted metrics', async () => {
            mockGetHealthMetrics.mockResolvedValue(mockMetrics);

            const response = await request(app).get('/api/metrics');

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('text/plain');
            expect(response.text).toContain('# HELP memestream_uptime_seconds');
            expect(response.text).toContain('# TYPE memestream_uptime_seconds gauge');
            expect(response.text).toContain('memestream_uptime_seconds 3600');
            expect(mockGetHealthMetrics).toHaveBeenCalledTimes(1);
        });

        it('should format all metrics correctly', async () => {
            mockGetHealthMetrics.mockResolvedValue(mockMetrics);

            const response = await request(app).get('/api/metrics');

            // Check that all metrics are present
            for (const [key, value] of Object.entries(mockMetrics)) {
                expect(response.text).toContain(`${key} ${value}`);
            }
        });

        it('should return 500 when metrics generation fails', async () => {
            mockGetHealthMetrics.mockRejectedValue(new Error('Metrics collection failed'));

            const response = await request(app).get('/api/metrics');

            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                error: 'Failed to generate metrics',
                message: 'Metrics collection failed'
            });
        });
    });

    describe('GET /api/status', () => {
        it('should return simplified status information', async () => {
            const response = await request(app).get('/api/status');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                status: 'healthy',
                uptime: 3600,
                timestamp: mockHealthySystem.timestamp,
                components: {
                    queue: 'healthy',
                    redis: 'healthy',
                    browser: 'healthy',
                    cache: 'healthy'
                },
                stats: {
                    jobsProcessed: 100,
                    jobsFailed: 5,
                    successRate: '95.2%',
                    avgJobTime: '250ms'
                }
            });
        });

        it('should show unhealthy components in status', async () => {
            const unhealthySystem = {
                ...mockHealthySystem,
                status: 'degraded' as const,
                components: {
                    ...mockHealthySystem.components,
                    browser: {
                        status: 'unhealthy' as const,
                        available: false
                    }
                }
            };
            mockGetSystemHealth.mockResolvedValue(unhealthySystem);

            const response = await request(app).get('/api/status');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('degraded');
            expect(response.body.components.browser).toBe('unhealthy');
        });

        it('should return 500 when status check fails', async () => {
            mockGetSystemHealth.mockRejectedValue(new Error('Status check failed'));

            const response = await request(app).get('/api/status');

            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                error: 'Status check failed',
                message: 'Status check failed'
            });
        });

        it('should format performance stats correctly', async () => {
            const systemWithStats = {
                ...mockHealthySystem,
                performance: {
                    ...mockHealthySystem.performance,
                    successRate: 99.5,
                    averageJobTime: 125
                }
            };
            mockGetSystemHealth.mockResolvedValue(systemWithStats);

            const response = await request(app).get('/api/status');

            expect(response.body.stats.successRate).toBe('99.5%');
            expect(response.body.stats.avgJobTime).toBe('125ms');
        });
    });

    describe('Error Handling', () => {
        it('should handle non-Error objects in catch blocks', async () => {
            mockIsSystemHealthy.mockRejectedValue('String error' as never);

            const response = await request(app).get('/api/health');

            expect(response.status).toBe(503);
            expect(response.body.error).toBe('Health check failed');
        });

        it('should handle undefined errors gracefully', async () => {
            mockGetHealthMetrics.mockRejectedValue(undefined as never);

            const response = await request(app).get('/api/metrics');

            expect(response.status).toBe(500);
            expect(response.body.message).toBe('Unknown error');
        });
    });

    describe('Integration', () => {
        it('should handle multiple concurrent requests', async () => {
            const requests = [
                request(app).get('/api/health'),
                request(app).get('/api/ready'),
                request(app).get('/api/status')
            ];

            const responses = await Promise.all(requests);

            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });

        it('should maintain consistent timestamps', async () => {
            const healthResponse = await request(app).get('/api/health');
            const readyResponse = await request(app).get('/api/ready');

            // Both should have timestamps
            expect(healthResponse.body.timestamp).toBeDefined();
            expect(readyResponse.body.timestamp).toBeDefined();

            // Timestamps should be valid ISO strings
            expect(() => new Date(healthResponse.body.timestamp)).not.toThrow();
            expect(() => new Date(readyResponse.body.timestamp)).not.toThrow();
        });
    });
});