// src/health-routes.ts
import { Router, Request, Response } from 'express';
import { getSystemHealth, isSystemHealthy, isSystemReady, getHealthMetrics } from './bot/core/health.js';

const router = Router();

// Liveness probe - basic health check for load balancers
router.get('/health', async (req: Request, res: Response) => {
    try {
        const healthy = await isSystemHealthy();
        
        if (healthy) {
            res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
        } else {
            res.status(503).json({ status: 'Service Unavailable', timestamp: new Date().toISOString() });
        }
    } catch (error) {
        res.status(503).json({ 
            status: 'Service Unavailable', 
            error: 'Health check failed',
            timestamp: new Date().toISOString() 
        });
    }
});

// Readiness probe - more comprehensive check for Kubernetes
router.get('/ready', async (req: Request, res: Response) => {
    try {
        const ready = await isSystemReady();
        
        if (ready) {
            res.status(200).json({ status: 'Ready', timestamp: new Date().toISOString() });
        } else {
            res.status(503).json({ status: 'Not Ready', timestamp: new Date().toISOString() });
        }
    } catch (error) {
        res.status(503).json({ 
            status: 'Not Ready', 
            error: 'Readiness check failed',
            timestamp: new Date().toISOString() 
        });
    }
});

// Detailed health information - for monitoring dashboards
router.get('/health/detailed', async (req: Request, res: Response) => {
    try {
        const health = await getSystemHealth();
        res.status(health.status === 'unhealthy' ? 503 : 200).json(health);
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString() 
        });
    }
});

// Prometheus metrics endpoint
router.get('/metrics', async (req: Request, res: Response) => {
    try {
        const metrics = await getHealthMetrics();
        
        // Convert to Prometheus format
        let prometheusOutput = '';
        for (const [key, value] of Object.entries(metrics)) {
            prometheusOutput += `# HELP ${key} MemeStream application metric\n`;
            prometheusOutput += `# TYPE ${key} gauge\n`;
            prometheusOutput += `${key} ${value}\n\n`;
        }
        
        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(prometheusOutput);
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to generate metrics',
            message: error instanceof Error ? error.message : 'Unknown error' 
        });
    }
});

// Simple status endpoint for quick checks
router.get('/status', async (req: Request, res: Response) => {
    try {
        const health = await getSystemHealth();
        res.json({
            status: health.status,
            uptime: health.uptime,
            timestamp: health.timestamp,
            components: {
                queue: health.components.queue.status,
                redis: health.components.redis.status,
                browser: health.components.browser.status,
                cache: health.components.cache.status
            },
            stats: {
                jobsProcessed: health.components.queue.metrics.jobsProcessed,
                jobsFailed: health.components.queue.metrics.jobsFailed,
                successRate: `${health.performance.successRate.toFixed(1)}%`,
                avgJobTime: `${health.performance.averageJobTime}ms`
            }
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Status check failed',
            message: error instanceof Error ? error.message : 'Unknown error' 
        });
    }
});

export default router;

/* 
Usage in your main server file (src/bot/core/server.ts):

import express from 'express';
import healthRoutes from '../../health-routes.js';

const app = express();

// Add health check routes
app.use('/api', healthRoutes);

// Your existing webhook and other routes...
app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, webhook);

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health endpoint: http://localhost:${PORT}/api/health`);
    console.log(`🔍 Detailed health: http://localhost:${PORT}/api/health/detailed`);
    console.log(`📈 Metrics: http://localhost:${PORT}/api/metrics`);
});
*/
