
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { initializeBrowser, gracefulShutdown } from './browser.js';
import { startServer } from './server.js';
import { handleStartCommand, handleMemeCommand, handleCallbackQuery, cleanupContexts } from './handlers.js';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set in your .env file.');
    process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

const initializeBot = async () => {
    try {
        await initializeBrowser();

        const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL || process.env.WEBHOOK_URL;
        const WEBHOOK_PATH = `/webhook/${TELEGRAM_BOT_TOKEN}`;
        const fullWebhookUrl = `${WEBHOOK_URL}${WEBHOOK_PATH}`;

        await bot.setWebHook(fullWebhookUrl, {
            allowed_updates: ['message', 'callback_query'],
        });

        console.log('✅ Webhook set successfully!');

        const webhookInfo = await bot.getWebHookInfo();
        console.log('📡 Webhook Info:', {
            url: webhookInfo.url,
            pending_update_count: webhookInfo.pending_update_count,
            last_error_date: webhookInfo.last_error_date,
            last_error_message: webhookInfo.last_error_message
        });

    } catch (error) {
        console.error('❌ Failed to initialize bot:', error);
        process.exit(1);
    }
};

const main = async () => {
    await initializeBot();

    handleStartCommand(bot);
    handleMemeCommand(bot);
    handleCallbackQuery(bot);
    cleanupContexts();

    startServer(bot);

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
};

main();
