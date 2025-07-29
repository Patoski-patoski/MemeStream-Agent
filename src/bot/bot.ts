// src/telegram-bot/index.ts
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { chromium, Browser, Page } from 'playwright';

import { runMemeAgent } from '../meme-generator/agents/memegeneratorAgent.js';
import { ProgressTracker } from '../meme-generator/types/types.js';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set in your .env file.');
    process.exit(1);
}

// ⭐ GLOBAL BROWSER INSTANCE ⭐
let globalBrowser: Browser | undefined;
let isBrowserLaunching = false;

async function initializeBrowser() {
    if (globalBrowser || isBrowserLaunching) {
        console.log('Browser already initialized or launching...');
        return;
    }
    isBrowserLaunching = true;
    console.log('Launching Playwright browser...');
    try {
        globalBrowser = await chromium.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log('Playwright browser launched.');
    } catch (error) {
        console.error('Failed to launch Playwright browser:', error);
        process.exit(1);
    } finally {
        isBrowserLaunching = false;
    }
}
initializeBrowser();

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

console.log('Telegram bot started...');

// Enhanced welcome message
bot.onText(/^\/start$/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        '🎭 *Welcome to Meme Generator Bot!* 🎭\n\n' +
        '🚀 I can help you find any meme and its history!\n\n' +
        '📝 *How to use:*\n' +
        '• Type `/meme [meme name]` to search\n' +
        '• Example: `/meme Distracted Boyfriend`\n\n' +
        '⏱️ *Please note:* Searches take 15-20 seconds as I gather comprehensive meme data including origin stories and image collections!',
        { parse_mode: 'Markdown' }
    );
});

// Enhanced progress tracking


const progressMessages = [
    "🔍 Initializing meme search...",
    "🌐 Navigating to meme database...",
    "🎯 Found your meme! Gathering details...",
    "📚 Researching meme origin story...",
    "🖼️ Collecting meme images...",
    "📊 Processing and organizing data...",
    "✨ Almost ready! Finalizing results..."
];

async function updateProgress(tracker: ProgressTracker, message: string, emoji?: string) {
    const elapsed = Math.round((Date.now() - tracker.startTime) / 1000);
    const progressBar = "█".repeat(tracker.currentStep) + "░".repeat(tracker.totalSteps - tracker.currentStep);

    try {
        await bot.editMessageText(
            `${emoji || "⏳"} *Processing your meme request...*\n\n` +
            `📊 Progress: [${progressBar}] ${tracker.currentStep}/${tracker.totalSteps}\n\n` +
            `${message}\n\n` +
            `⏱️ Elapsed: ${elapsed}s | Estimated: 15-20s`,
            {
                chat_id: tracker.chatId,
                message_id: tracker.messageId,
                parse_mode: 'Markdown'
            }
        );
    } catch (error) {
        console.error('Error updating progress:', error);
    }
}

bot.onText(/^\/meme (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const memeName = match?.[1];
    console.log("Memename:", memeName);

    if (!memeName) {
        bot.sendMessage(chatId,
            '❌ *Please provide a meme name*\n\n' +
            '📝 Example: `/meme Distracted Boyfriend`\n' +
            '💡 Try popular memes like: Drake, Wojak, Pepe, etc.',
            { parse_mode: 'Markdown' }
        );
        return;
    }

    if (!globalBrowser) {
        await bot.sendMessage(chatId,
            '🚀 *Bot is starting up...*\n\n' +
            '⚙️ Initializing browser engine...\n' +
            '⏳ Please try again in a moment!',
            { parse_mode: 'Markdown' }
        );
        return;
    }

    // Create initial progress message
    const initialMessage = await bot.sendMessage(chatId, progressMessages[0]);

    const tracker: ProgressTracker = {
        chatId,
        messageId: initialMessage.message_id,
        currentStep: 1,
        totalSteps: 6,
        startTime: Date.now()
    };

    // Progress update intervals
    const progressInterval = setInterval(async () => {
        if (tracker.currentStep < tracker.totalSteps) {
            tracker.currentStep++;
            await updateProgress(tracker, progressMessages[tracker.currentStep - 1]);
        }
    }, 10000); // Update every 10 seconds

    // Patience message after 10 seconds
    const patienceTimeout = setTimeout(async () => {
        try {
            await bot.sendMessage(chatId,
                '🤖 *Hang tight! I\'m working hard on your request* 🤖\n\n' +
                '🔍 Currently processing:\n' +
                '• 🎭 Searching meme databases\n' +
                '• 📚 Gathering origin stories\n' +
                '• 🖼️ Collecting image examples\n' +
                '• ✨ Organizing results\n\n' +
                '⏱️ *Average processing time: 15-20 seconds*\n' +
                '🎯 Your results will be worth the wait!',
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.error('Error sending patience message:', error);
        }
    }, 10000);

    let page: Page | undefined;
    try {
        page = await globalBrowser.newPage();
        console.log(`Opened new page for request from chat ID: ${chatId}`);

        // Enhanced ResponseHandler with better formatting
        const responseHandler = {
            page,
            async sendUpdate(text: string) {
                try {
                    // Handle origin story
                    if (text.includes("origin") || text.includes("Origin")) {
                        const formattedText = text
                            .replace(/\*\*/g, '*')
                            .substring(0, 3500); // Leave room for our header

                        await bot.sendMessage(chatId,
                            `📚 *Meme Origin & History* 📚\n\n${formattedText}\n\n` +
                            `🔍 *Still gathering more data for you...*`,
                            { parse_mode: 'Markdown' }
                        );
                        return;
                    }

                    // Handle final summary with better formatting
                    const summaryText = text
                        .replace(/\*\*/g, '*')
                        .replace(/Main Page URL:/g, '🌐 *Source Page:*')
                        .replace(/Blank Template URL:/g, '🎨 *Blank Template:*')
                        .replace(/Scraped Images:/g, '🖼️ *Image Collection:*')
                        .substring(0, 3500);

                    await bot.sendMessage(chatId,
                        `📋 *Meme Summary* 📋\n\n${summaryText}`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (error) {
                    console.error('Error sending formatted message:', error);
                    await bot.sendMessage(chatId, text);
                }
            },

            async sendImages(images: { alt: string; src: string }[]) {
                // Filter and limit images
                const relevantImages = images
                    .filter(img => img.src.includes('http'))
                    .slice(0, 6); // Increased to 6 for better variety

                if (relevantImages.length === 0) {
                    await bot.sendMessage(chatId,
                        '📷 *No suitable images found for preview*\n\n' +
                        'But you can use the blank template and source page links above! 🎨'
                    );
                    return;
                }

                // Send a header message for the image collection
                await bot.sendMessage(chatId,
                    `🖼️ *Image Preview Collection* (${relevantImages.length} images)\n\n` +
                    `📸 Here are some popular examples of this meme:`,
                    { parse_mode: 'Markdown' }
                );

                // Send images with enhanced captions
                for (let i = 0; i < relevantImages.length; i++) {
                    const image = relevantImages[i];
                    try {
                        const caption = `🎭 *Example ${i + 1}/${relevantImages.length}*\n\n` +
                            `${image.alt.replace(/"/g, '').substring(0, 200)}` +
                            (image.alt.length > 200 ? '...' : '');

                        await bot.sendPhoto(chatId, image.src, {
                            caption,
                            parse_mode: 'Markdown'
                        });

                        // Delay between images to avoid rate limits
                        if (i < relevantImages.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    } catch (error) {
                        console.error(`Error sending image ${i + 1}:`, error);
                        // Continue with next image instead of stopping
                    }
                }

                // Send completion message
                await bot.sendMessage(chatId,
                    '✅ *Meme search completed successfully!* ✅\n\n' +
                    '🎨 Use the blank template to create your own\n' +
                    '🔄 Search for another meme with `/meme [name]`\n\n' +
                    '💡 *Tip:* Popular searches include Drake, Distracted Boyfriend, Epic handshake, etc.',
                    {
                        parse_mode: 'Markdown',
                    }
                );
            }
        };

        // Run the meme agent
        const response = await runMemeAgent(memeName, responseHandler);

        // Clear timeouts and intervals
        clearTimeout(patienceTimeout);
        clearInterval(progressInterval);

        // Final progress update
        tracker.currentStep = tracker.totalSteps;
        await updateProgress(tracker, "✅ Completed successfully!", "🎉");

    } catch (error) {
        console.error("Error processing meme request:", error);

        // Clear timeouts and intervals
        clearTimeout(patienceTimeout);
        clearInterval(progressInterval);

        await bot.editMessageText(
            '❌ *Oops! Something went wrong* ❌\n\n' +
            '🔧 There was an issue processing your request\n' +
            '💡 Please try again with a different meme name\n\n' +
            '🆘 If the problem persists, the meme might not be in our database',
            {
                chat_id: tracker.chatId,
                message_id: tracker.messageId,
                parse_mode: 'Markdown'
            }
        );
    } finally {
        if (page) {
            await page.close();
            console.log(`Closed page for request from chat ID: ${chatId}`);
        }
    }
});

// Enhanced error handling
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT. Shutting down bot and browser...');
    bot.stopPolling().catch(err => console.error('Error stopping polling:', err));

    if (globalBrowser) {
        console.log('Closing Playwright browser...');
        await globalBrowser.close();
        console.log('Playwright browser closed.');
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Shutting down bot and browser...');
    bot.stopPolling().catch(err => console.error('Error stopping polling:', err));
    if (globalBrowser) {
        console.log('Closing Playwright browser...');
        await globalBrowser.close();
        console.log('Playwright browser closed.');
    }
    process.exit(0);
});