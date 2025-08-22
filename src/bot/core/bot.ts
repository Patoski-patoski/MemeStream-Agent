// src/bot/core/bot.ts

import TelegramBot from 'node-telegram-bot-api';
import { initializeBrowser, closeBrowser } from './browser.js';
import {
    handleStartCommand,
    handleHelpCommand,
    handleMemeCommand,
    handleBlankMemeCommand,
    handleCallbackQuery,
    setupBotCommands
} from './handlers.js';
import { memeCache } from './cache.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not defined in the environment variables');
    process.exit(1);
}

// Create and export the bot instance so the worker can use it
export const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

let isInitializing = false;

/**
 * Initializes the Telegram bot by setting up the browser and webhook.
 *
 * This function ensures that bot initialization is not attempted concurrently.
 * If another initialization is in progress, it will wait until that one completes.
 *
 * @throws if the bot initialization fails
 */
async function initialize() {
    if (isInitializing) {
        console.log('⏳ Bot initialization in progress, waiting...');
        return;
    }
    isInitializing = true;
    console.log('🚀 Starting Meme Generator Bot...');

    try {
        console.log('🌐 Initializing browser...');
        await initializeBrowser();
        console.log('✅ Browser initialized successfully');

        const WEBHOOK_URL = process.env.WEBHOOK_URL;
        if (WEBHOOK_URL) {
            console.log('📡 Setting webhook...');
            const webhookEndpoint = `${WEBHOOK_URL}/webhook/${TELEGRAM_BOT_TOKEN}`;
            await bot.setWebHook(webhookEndpoint);
            console.log('✅ Webhook set successfully!');
            const webhookInfo = await bot.getWebHookInfo();
            console.log('📡 Webhook Info:', webhookInfo);
        } else {
            console.warn('⚠️ WEBHOOK_URL not set, using polling mode (not recommended for production)');
        }

        console.log('🎉 Bot initialization completed successfully!');
    } catch (error) {
        console.error('❌ Failed to initialize bot:', error);
        isInitializing = false;
        throw error;
    } finally {
        isInitializing = false;
    }
}

/**
 * Starts the bot, initializing it if necessary, and sets up the bot commands and
 * event handlers. If the bot initialization fails, it will retry up to 5 times.
 * If all retries fail, it will exit the process with a non-zero status code.
 * @returns The bot instance, or null if the bot initialization failed.
 */
export async function startBot() {
    let retries = 5;
    while (retries > 0) {
        try {
            await initialize();
            console.log('🔧 Setting up bot commands and handlers...');
            await setupBotCommands(bot);
            handleStartCommand(bot);
            handleHelpCommand(bot);
            handleMemeCommand(bot);
            handleBlankMemeCommand(bot);
            handleCallbackQuery(bot);
            console.log('✅ Bot handlers configured successfully');
            return bot;
        } catch (error) {
            console.error(`❌ Bot initialization failed. Retrying... (${5 - retries + 1}/5)`);
            retries--;
            if (error && retries === 0) {
                console.error('❌ All retries failed. Exiting.');
                process.exit(1);
            }
            await new Promise(res => setTimeout(res, 5000));
        }
    }
    return null;
}


export function getBotInstance(): TelegramBot {
    return bot;
}

// Graceful shutdown for the main bot process
async function handleServerShutdown() {
    console.log('🛑 Received SIGTERM on server. Starting graceful shutdown...');
    try {
        console.log('📡 Removing webhook...');
        await bot.deleteWebHook();
        console.log('✅ Webhook removed');
    } catch (error) {
        console.error('❌ Error removing webhook:', error);
    }
    await memeCache.disconnect();
    await closeBrowser();
    console.log('✅ Server graceful shutdown completed');
    process.exit(0);
}

process.on('SIGTERM', handleServerShutdown);
process.on('SIGINT', handleServerShutdown);