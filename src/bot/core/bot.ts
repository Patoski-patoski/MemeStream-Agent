import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { initializeBrowser, gracefulShutdown } from './browser.js';
import { startServer } from './server.js';
import {
    handleStartCommand,
    handleHelpCommand,
    handleBlankMemeCommand,
    handleMemeCommand,
    handleCallbackQuery,
    setupBotCommands,
} from './handlers.js';

import {
    MAX_RETRIES,
    MAX_RETRY_DELAY,
    INITIAL_RETRY_DELAY,
    TELEGRAM_BOT_TOKEN
} from '../utils/constants.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set in your .env file.');
    process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

// Helper function for exponential backoff delay
const getRetryDelay = (attempt: number): number => {
    const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
    return Math.min(delay, MAX_RETRY_DELAY);
};

// Helper function to wait for specified time
const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const initializeBot = async (): Promise<boolean> => {
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        try {
            console.log(`🔄 Bot initialization attempt ${attempt + 1}/${MAX_RETRIES}`);

            // Initialize browser first
            console.log('🌐 Initializing browser...');
            await initializeBrowser();
            console.log('✅ Browser initialized successfully');

            // Set up webhook
            const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL || process.env.WEBHOOK_URL;

            if (!WEBHOOK_URL) {
                throw new Error('WEBHOOK_URL or RENDER_EXTERNAL_URL not set in environment variables');
            }

            const WEBHOOK_PATH = `/webhook/${TELEGRAM_BOT_TOKEN}`;
            const fullWebhookUrl = `${WEBHOOK_URL}${WEBHOOK_PATH}`;

            console.log('📡 Setting webhook...');
            await bot.setWebHook(fullWebhookUrl, {
                allowed_updates: ['message', 'callback_query'],
            });

            console.log('✅ Webhook set successfully!');

            // Verify webhook info
            const webhookInfo = await bot.getWebHookInfo();
            console.log('📡 Webhook Info:', {
                url: webhookInfo.url,
                pending_update_count: webhookInfo.pending_update_count,
                last_error_date: webhookInfo.last_error_date,
                last_error_message: webhookInfo.last_error_message
            });

            // If we reach here, initialization was successful
            console.log('🎉 Bot initialization completed successfully!');
            return true;

        } catch (error) {
            attempt++;
            const isLastAttempt = attempt >= MAX_RETRIES;

            console.error(`❌ Bot initialization attempt ${attempt} failed:`, error);

            if (isLastAttempt) {
                console.error('💥 All retry attempts exhausted. Bot initialization failed.');
                return false;
            }

            const retryDelay = getRetryDelay(attempt - 1);
            console.log(`⏳ Retrying in ${retryDelay}ms... (${MAX_RETRIES - attempt} attempts remaining)`);

            await sleep(retryDelay);
        }
    }

    return false; // This should never be reached, but TypeScript likes it
};

const setupBotHandlers = async () => {
    try {
        console.log('🔧 Setting up bot commands and handlers...');

        await setupBotCommands(bot);
        handleStartCommand(bot);
        handleBlankMemeCommand(bot);
        handleMemeCommand(bot);
        handleCallbackQuery(bot);
        handleHelpCommand(bot);

        // Start cleanup process
        console.log('✅ Bot handlers configured successfully');
    } catch (error) {
        console.error('❌ Error setting up bot handlers:', error);
        throw error;
    }
};

const main = async () => {
    console.log('🚀 Starting Meme Generator Bot...');

    try {
        // Initialize bot with retry mechanism
        const initSuccess = await initializeBot();

        if (!initSuccess) {
            console.error('💥 Failed to initialize bot after all retry attempts');
            process.exit(1);
        }

        await setupBotHandlers();

        console.log('🌐 Starting server...');
        startServer(bot);

        console.log('🎭 Meme Generator Bot is now running!');
        console.log('📝 Available commands:');
        console.log('   • /start - Welcome message');
        console.log('   • /meme [name] - Full meme search');
        console.log('   • /blank [name] - Quick blank template');
        console.log('   • /help - Show help');

    } catch (error) {
        console.error('💥 Fatal error during bot startup:', error);
        process.exit(1);
    }
};

// Enhanced graceful shutdown
const handleShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    try {
        // Remove webhook
        console.log('📡 Removing webhook...');
        await bot.deleteWebHook();
        console.log('✅ Webhook removed');

        // Call existing graceful shutdown
        await gracefulShutdown(signal);

        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
};

// Set up signal handlers
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    handleShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    handleShutdown('UNHANDLED_REJECTION');
});

// Start the bot
main().catch((error) => {
    console.error('💥 Fatal error in main():', error);
    process.exit(1);
});