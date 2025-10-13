// src/bot/core/server.ts
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import http from 'http';
import TelegramBot from 'node-telegram-bot-api';
import { startBot } from './bot.js';
import { closeBrowser } from './browser.js';
import { memeCache } from './cache.js';
import healthRoutes from '../../health-routes.js';

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 3300;
let server: http.Server;

app.use(express.json());

// Mount health routes under /api prefix
app.use('/api', healthRoutes);

app.get('/health', (req: Request, res: Response) => {
    console.log('Health check requested:', {
        timestamp: new Date().toISOString(),
        headers: req.headers
    });
    
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req: Request, res: Response) => {
    res.json({
        message: 'Meme Generator Bot is running!',
        webhook: 'Active',
        timestamp: new Date().toISOString()
    });
});

/**
 * Starts a webhook server for Telegram bot updates.
 *
 * The server listens on a configurable port (default 3300) and accepts
 * incoming POST requests to the `/webhook/${TELEGRAM_BOT_TOKEN}` path.
 * The request body is passed to the `bot.processUpdate` method.
 *
 * The server also exposes a health check endpoint at `/health` which
 * returns a JSON response with the status `OK` and a timestamp.
 *
 * @param {TelegramBot} bot The Telegram bot instance to handle updates
 * @returns {Promise<http.Server>} A promise that resolves to the started server
 */
export const startServer = (bot: TelegramBot): Promise<http.Server> => {
    return new Promise((resolve) => {
        const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL || process.env.WEBHOOK_URL;
        const WEBHOOK_PATH = `/webhook/${TELEGRAM_BOT_TOKEN}`;

        app.post(WEBHOOK_PATH, (req, res) => {
            bot.processUpdate(req.body);
            res.sendStatus(200);
        });

        server = app.listen(Number(PORT), '0.0.0.0', () => {
            console.log(`🚀 Webhook server running on port ${PORT}`);
            console.log(`📡 Webhook URL: ${WEBHOOK_URL}${WEBHOOK_PATH}`);
            console.log(`🌐 Health check: ${WEBHOOK_URL}/health`);
            console.log(`📊 API Health endpoints:`);
            console.log(`   • Basic health: ${WEBHOOK_URL}/api/health`);
            console.log(`   • Detailed health: ${WEBHOOK_URL}/api/health/detailed`);
            console.log(`   • Readiness: ${WEBHOOK_URL}/api/ready`);
            console.log(`   • Status: ${WEBHOOK_URL}/api/status`);
            console.log(`   • Metrics: ${WEBHOOK_URL}/api/metrics`);
            console.log(`🎭 Meme bot ready to receive webhooks!`);
            resolve(server);
        });
    });
};

/**
 * Close the Express.js server instance.
 *
 * Returns a Promise that resolves when the server is fully closed.
 *
 * Note: This function does nothing if the server is not listening.
 */
export const closeServer = (): Promise<void> => {
    return new Promise((resolve) => {
        if (server && server.listening) {
            server.close(() => {
                resolve();
            });
        } else {
            resolve();
        }
    });
};

/**
 * Performs a graceful shutdown of the server, closing the browser instance,
 * and disconnecting from the Redis cache.
 * This function is bound to the SIGTERM and SIGINT events, allowing the process
 * to exit cleanly when terminated.
 */
async function gracefulShutdown() {
    console.log('Shutting down server...');
    await closeServer();
    await closeBrowser();
    await memeCache.disconnect();
    process.exit(0);
}

// Main application entry point
async function main() {
    try {
        console.log("Initializing bot...");
        const bot = await startBot();
        if (bot) {
            await startServer(bot);
            console.log("Application started successfully.");
        } else {
            throw new Error("Bot initialization failed.");
        }
    } catch (error) {
        console.error("Fatal error during application startup:", error);
        process.exit(1);
    }
}

if (process.env.JEST_WORKER_ID === undefined) {
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    main();
}
