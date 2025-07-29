// src/telegram-bot/index.ts
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { chromium, Browser, Page } from 'playwright';

import { runMemeAgent } from '../meme-generator/agents/memegeneratorAgent.js';
import {
    ProgressTracker,
    MemeContext
} from '../meme-generator/types/types.js';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set in your .env file.');
    process.exit(1);
}

// ⭐ GLOBAL BROWSER INSTANCE ⭐
let globalBrowser: Browser | undefined;
let isBrowserLaunching = false;

// Store active meme contexts (in memory for session)
const activeMemeContexts = new Map<number, MemeContext>();

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

        // Enhanced responseHandler in your bot.onText(/^\/meme (.+)/, async (msg, match) => {
        const responseHandler = {
            page,
            async sendUpdate(text: string) {
                try {
                    // Handle origin story
                    if (text.includes("origin") || text.includes("Origin")) {
                        const formattedText = text
                            .replace(/\*\*/g, '*')
                            .substring(0, 3500);

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
                const relevantImages = images.filter(img =>
                    img.src.includes('http'));

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

                        if (i < relevantImages.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    } catch (error) {
                        console.error(`Error sending image ${i + 1}:`, error);
                    }
                }

                // ENHANCED: Send completion message with inline keyboard
                const inlineKeyboard = {
                    inline_keyboard: [
                        [
                            {
                                text: '🎨 Get Blank Template',
                                callback_data: `blank_template_${chatId}`
                            },
                            {
                                text: '🔍 View More Templates',
                                callback_data: `more_templates_${chatId}`
                            }
                        ],
                        [
                            {
                                text: '🔄 Search Another Meme',
                                callback_data: `new_search_${chatId}`
                            }
                        ]
                    ]
                };

                await bot.sendMessage(chatId,
                    '✅ *Meme search completed successfully!* ✅\n\n' +
                    '🎨 Use the blank template to create your own\n' +
                    '🔄 Search for another meme with `/meme [name]`\n\n' +
                    '💡 *Tip:* Popular searches include Drake, Distracted Boyfriend, This is Fine, etc.',
                    {
                        parse_mode: 'Markdown',
                        reply_markup: inlineKeyboard
                    }
                );
            }
        };

        // Run the meme agent and store context
        const response = await runMemeAgent(memeName, responseHandler);

        // Store the meme context for inline keyboard callbacks
        if (response && response.memePageUrl && response.blankMemeUrl) {
            activeMemeContexts.set(chatId, {
                memePageUrl: response.memePageUrl,
                blankTemplateUrl: response.blankMemeUrl,
                memeName: memeName,
                currentPage: 1,  // Start at page 1
                lastRequestTime: Date.now()
            });
        }
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


// ADD THESE CALLBACK HANDLERS AFTER YOUR EXISTING bot.onText HANDLERS:
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = msg?.chat.id;

    if (!chatId || !data) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Invalid request" });
        return;
    }

    try {
        // Answer the callback query first
        await bot.answerCallbackQuery(callbackQuery.id);

        if (data.startsWith('blank_template_')) {
            const extractedChatId = parseInt(data.split('_')[2]);
            const context = activeMemeContexts.get(extractedChatId);
            
            if (!context) {
                await bot.sendMessage(chatId, 
                    '❌ *Template not available*\n\n' +
                    'Please search for a meme first using `/meme [name]`',
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            // Update last request time
            context.lastRequestTime = Date.now();

            await bot.sendPhoto(chatId, context.blankTemplateUrl, {
                caption: `🎨 *Blank Template for "${context.memeName}"*\n\n` +
                        `📝 Right-click to save this image\n` +
                        `✨ Add your own text to create a custom meme!\n\n` +
                        `🔗 Source: ${context.memePageUrl}`,
                parse_mode: 'Markdown'
            });

        } else if (data.startsWith('more_templates_')) {
            const extractedChatId = parseInt(data.split('_')[2]);
            const context = activeMemeContexts.get(extractedChatId);
            
            if (!context) {
                await bot.sendMessage(chatId, 
                    '❌ *Additional templates not available*\n\n' +
                    'Please search for a meme first using `/meme [name]`',
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            // ENHANCED: Rate limiting check (prevent spam clicking)
            const timeSinceLastRequest = Date.now() - context.lastRequestTime;
            if (timeSinceLastRequest < 3000) { // 3 second cooldown
                await bot.answerCallbackQuery(callbackQuery.id, { 
                    text: "Please wait a moment before requesting more templates.",
                    show_alert: true 
                });
                return;
            }

            // INCREMENT PAGE COUNTER
            context.currentPage += 1;
            context.lastRequestTime = Date.now();

            // Show loading message with page info
            const loadingMsg = await bot.sendMessage(chatId, 
                `🔍 *Loading templates from page ${context.currentPage}...*\n\n` +
                `📄 Fetching more examples for "${context.memeName}"...`,
                { parse_mode: 'Markdown' }
            );

            if (!globalBrowser) {
                await bot.editMessageText(
                    '❌ Browser not available. Please try again later.',
                    { chat_id: chatId, message_id: loadingMsg.message_id }
                );
                return;
            }

            let page: Page | undefined;
            try {
                page = await globalBrowser.newPage();
                
                // ENHANCED: Smart URL construction for any page number
                const nextPageUrl = constructPageUrl(context.memePageUrl, context.currentPage);

                console.log(`Scraping page ${context.currentPage} from: ${nextPageUrl}`);

                // Import the scraping function
                const { scrapeMemeImagesFromPage } = await import('../meme-generator/tools/meme-generator-tools.js');
                
                // Scrape the current page
                const moreImages = await scrapeMemeImagesFromPage(page, nextPageUrl);

                // Check if we found any images
                if (!moreImages || moreImages.length === 0) {
                    // NO MORE PAGES - Reset to last working page
                    context.currentPage = Math.max(1, context.currentPage - 1);
                    
                    await bot.editMessageText(
                        `📄 *No more templates found on page ${context.currentPage + 1}*\n\n` +
                        `🎯 You've reached the end! Currently on page ${context.currentPage}.\n` +
                        `💡 Use the blank template or search for another meme.`,
                        { 
                            chat_id: chatId, 
                            message_id: loadingMsg.message_id,
                            parse_mode: 'Markdown'
                        }
                    );

                    // Send final keyboard without "View More" option
                    const finalKeyboard = {
                        inline_keyboard: [
                            [
                                {
                                    text: '🎨 Get Blank Template',
                                    callback_data: `blank_template_${chatId}`
                                }
                            ],
                            [
                                {
                                    text: '🔄 Search Another Meme',
                                    callback_data: `new_search_${chatId}`
                                },
                                {
                                    text: '🔙 Back to Page 1',
                                    callback_data: `reset_pages_${chatId}`
                                }
                            ]
                        ]
                    };

                    await bot.sendMessage(chatId,
                        '🏁 *End of templates reached*',
                        { 
                            parse_mode: 'Markdown',
                            reply_markup: finalKeyboard
                        }
                    );
                    return;
                }

                await bot.editMessageText(
                    `✅ Found ${moreImages.length} templates on page ${context.currentPage}!`,
                    { chat_id: chatId, message_id: loadingMsg.message_id }
                );

                // Filter and send images
                const relevantImages = moreImages.filter(img => img.src.includes('http'));

                if (relevantImages.length > 0) {
                    await bot.sendMessage(chatId,
                        `🔍 *Page ${context.currentPage} Templates* (${relevantImages.length} images)\n\n` +
                        `📸 More examples of "${context.memeName}":`,
                        { parse_mode: 'Markdown' }
                    );

                    // Send images
                    for (let i = 0; i < relevantImages.length; i++) {
                        const image = relevantImages[i];
                        try {
                            const caption = `🎭 *Page ${context.currentPage} - Example ${i + 1}/${relevantImages.length}*\n\n` +
                                `${image.alt.replace(/"/g, '').substring(0, 200)}` +
                                (image.alt.length > 200 ? '...' : '');

                            await bot.sendPhoto(chatId, image.src, { 
                                caption,
                                parse_mode: 'Markdown'
                            });
                            
                            if (i < relevantImages.length - 1) {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                        } catch (error) {
                            console.error(`Error sending image ${i + 1} from page ${context.currentPage}:`, error);
                        }
                    }

                    // ENHANCED: Smart keyboard with page info
                    const continueKeyboard = {
                        inline_keyboard: [
                            [
                                {
                                    text: '🎨 Get Blank Template',
                                    callback_data: `blank_template_${chatId}`
                                },
                                {
                                    text: `🔍 Page ${context.currentPage + 1} →`,
                                    callback_data: `more_templates_${chatId}`
                                }
                            ],
                            [
                                {
                                    text: '🔄 Search Another Meme',
                                    callback_data: `new_search_${chatId}`
                                },
                                {
                                    text: '🔙 Back to Page 1',
                                    callback_data: `reset_pages_${chatId}`
                                }
                            ]
                        ]
                    };

                    await bot.sendMessage(chatId,
                        `📋 *Page ${context.currentPage} loaded!*\n\n` +
                        `📊 Total pages explored: ${context.currentPage}\n` +
                        `🔍 Click "Page ${context.currentPage + 1} →" for more templates!`,
                        { 
                            parse_mode: 'Markdown',
                            reply_markup: continueKeyboard
                        }
                    );
                } else {
                    // No relevant images found
                    context.currentPage = Math.max(1, context.currentPage - 1);
                    await bot.sendMessage(chatId,
                        `😅 *No suitable templates on page ${context.currentPage + 1}*\n\n` +
                        `🎯 Staying on page ${context.currentPage}. Try the blank template!`,
                        { parse_mode: 'Markdown' }
                    );
                }

            } catch (error) {
                console.error(`Error loading page ${context.currentPage}:`, error);
                // Revert page counter on error
                context.currentPage = Math.max(1, context.currentPage - 1);
                
                await bot.editMessageText(
                    `❌ *Error loading page ${context.currentPage + 1}*\n\n` +
                    'Please try again or use previous results.',
                    { 
                        chat_id: chatId, 
                        message_id: loadingMsg.message_id,
                        parse_mode: 'Markdown'
                    }
                );
            } finally {
                if (page) {
                    await page.close();
                    console.log(`Closed page for page ${context.currentPage} request from chat ID: ${chatId}`);
                }
            }

        } else if (data.startsWith('reset_pages_')) {
            // NEW: Reset to page 1 functionality
            const extractedChatId = parseInt(data.split('_')[2]);
            const context = activeMemeContexts.get(extractedChatId);
            
            if (context) {
                context.currentPage = 1;
                context.lastRequestTime = Date.now();
                
                await bot.sendMessage(chatId,
                    `🔙 *Reset to Page 1*\n\n` +
                    `📄 Page counter reset for "${context.memeName}"\n` +
                    `🔍 Click "View More Templates" to start exploring again!`,
                    { parse_mode: 'Markdown' }
                );
            }

        } else if (data.startsWith('new_search_')) {
            // Clear context for new search
            activeMemeContexts.delete(chatId);
            
            await bot.sendMessage(chatId,
                '🔍 *Ready for a new search!*\n\n' +
                '📝 Use `/meme [name]` to search for another meme\n\n' +
                '💡 *Popular memes:* Drake, Distracted Boyfriend, This is Fine, Wojak, Pepe, Expanding Brain',
                { parse_mode: 'Markdown' }
            );
        }

    } catch (error) {
        console.error('Error handling callback query:', error);
        await bot.answerCallbackQuery(callbackQuery.id, { 
            text: "Something went wrong. Please try again.",
            show_alert: true 
        });
    }
});

// UTILITY FUNCTION: Smart URL construction for any page
function constructPageUrl(baseUrl: string, pageNumber: number): string {
    try {
        const url = new URL(baseUrl);
        url.searchParams.set('page', pageNumber.toString());
        return url.toString();
    } catch (error) {
        // Fallback for malformed URLs
        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}page=${pageNumber}`;
    }
}

// ENHANCED CLEANUP: More sophisticated memory management
setInterval(() => {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    let cleanedCount = 0;

    for (const [chatId, context] of activeMemeContexts.entries()) {
        // Remove contexts older than 30 minutes
        if (now - context.lastRequestTime > maxAge) {
            activeMemeContexts.delete(chatId);
            cleanedCount++;
        }
    }

    if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} expired meme contexts (30min+ old)`);
    }

    // Also limit total size
    if (activeMemeContexts.size > 200) {
        const entries = Array.from(activeMemeContexts.entries());
        // Sort by lastRequestTime and keep the 150 most recent
        entries.sort((a, b) => b[1].lastRequestTime - a[1].lastRequestTime);
        
        const toDelete = entries.slice(150);
        toDelete.forEach(([chatId]) => activeMemeContexts.delete(chatId));
        console.log(`🧹 Size limit cleanup: removed ${toDelete.length} oldest contexts`);
    }
}, 300000); // Clean every 5 minutes


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