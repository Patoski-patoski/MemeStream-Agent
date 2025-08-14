// src/bot/core/server.ts
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { getBrowser } from './browser.js';
import http from 'http';
import TelegramBot from 'node-telegram-bot-api';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const app = express();
const PORT = process.env.PORT || 3300;
let server: http.Server;

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
    console.log('Health check requested:', {
        timestamp: new Date().toISOString(),
        headers: req.headers
    });
    
    const browser = getBrowser();
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        browser: browser ? 'Ready' : 'Not Ready'
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
 * Starts an Express.js server that listens for Telegram webhook updates.
 * @param {object} bot - A Telegram Bot instance with a processUpdate method.
 * @returns {http.Server} The Express.js server instance.
 */
export const startServer = (bot: TelegramBot) => {
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
        console.log(`🎭 Meme bot ready to receive webhooks!`);
    });

    return server;
};

/**
 * Closes the Express.js server gracefully.
 * @returns {undefined} This function does not return a value.
 */
export const closeServer = () => {
    if (server) {
        server.close();
    }
};