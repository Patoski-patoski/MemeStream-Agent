// src/bot/core/handlers.ts
import TelegramBot from 'node-telegram-bot-api';
import { Page } from 'playwright';
import { getBrowser } from './browser.js';
import { runMemeAgent } from '../../meme-generator/agents/memegeneratorAgent.js';
import { searchMemeAndGetFirstLink } from '../../meme-generator/tools/meme-generator-tools.js';
import { ProgressTracker } from '../types/types.js';
import {
    // progressMessages,
    updateProgress,
    constructPageUrl
} from '../utils/utils.js';
import { formatMemeNameForUrl, extractMemeNameFromUrl } from '../utils/formatters.js';
import { memeCache } from './cache.js';

const MEME_URL = process.env.MEME_URL;

export const setupBotCommands = async (bot: TelegramBot) => {
    try {
        const commands = [
            {
                command: 'start',
                description: '🎭 Welcome message and bot introduction'
            },
            {
                command: 'meme',
                description: '🔍 Full meme search with history and examples'
            },
            {
                command: 'blank',
                description: '🎨 Get blank meme template instantly'
            },
            {
                command: 'help',
                description: '❓ Show help and usage instructions'
            }
        ];

        await bot.setMyCommands(commands);
        console.log('✅ Bot commands menu set successfully!');

        // Optional: Set commands for specific scopes
        // For private chats only
        await bot.setMyCommands(commands, {
            scope: { type: 'all_private_chats' }
        });

        // For group chats (if bot should works in groups)
        await bot.setMyCommands(commands, {
            scope: { type: 'all_group_chats' }
        });

    } catch (error) {
        console.error('❌ Error setting bot commands:', error);
    }
};

export const handleStartCommand = (bot: TelegramBot) => {
    bot.onText(/^\/start$/, (msg) => {
        const chatId = msg.chat.id;

        bot.sendMessage(chatId,
            '🎭 *Welcome to Meme Generator Bot!* 🎭\n\n' +
            '🚀 I can help you find any meme and its history!\n\n' +
            '📝 *Commands:*\n' +
            '• `/meme [name]` - Full meme search with history\n' +
            '• `/blank [name]` - Get blank template only\n\n' +
            '💡 *Examples:*\n' +
            '• `/meme Distracted Boyfriend`\n' +
            '• `/blank Drake hotline bling`\n\n' +
            '⏱️ *Please note:* Full searches take 15-20 seconds, blank templates are instant!',
            { parse_mode: 'Markdown' }
        );
    });
};

export const handleHelpCommand = (bot: TelegramBot) => {
    bot.onText(/^\/help$/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId,
            '🤖 **Meme Generator Bot Help** 🤖\n\n' +
            '📝 **Available Commands:**\n\n' +
            '🎭 `/start` - Welcome message and introduction\n' +
            '🔍 `/meme [name]` - Full meme search with history\n' +
            '   • Example: `/meme Distracted Boyfriend`\n' +
            '   • Includes origin story, history, examples\n' +
            '   • Takes 15-20 seconds for complete results\n\n' +
            '🎨 `/blank [name]` - Get blank template instantly\n' +
            '   • Example: `/blank Drake hotline bling`\n' +
            '   • Quick access to customizable templates\n' +
            '   • Instant results with editing links\n\n' +
            '❓ `/help` - Show this help message\n\n' +
            '💡 **Popular Memes to Try:**\n' +
            '• Drake hotline bling\n' +
            '• Distracted Boyfriend\n' +
            '• This is Fine\n' +
            '• Expanding Brain\n' +
            '• Chill guy\n' +
            '• Two buttons\n' +
            '• Epic handshake\n\n' +
            '🎯 **Tips:**\n' +
            '• Use `/blank` for quick templates\n' +
            '• Use `/meme` for complete meme information\n' +
            '• Check spelling if meme not found\n' +
            '• Try alternative meme names\n\n' +
            '🔗 **Need more help?** Contact @tnemyojne',
            { parse_mode: 'Markdown' }
        );
    });
};


/**
 * Handles the /blank command, which provides a blank meme template for the specified meme name.
 * If no meme name is provided, asks the user to provide one.
 * If the meme name is not found in the database, falls back to web scraping.
 * If the meme is found, sends the blank template with a rich caption.
 * Stores context for inline keyboard actions.
 */
export const handleBlankMemeCommand = (bot: TelegramBot) => {
    bot.onText(/^\/blank( (.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const memeName = match?.[1];

        if (!memeName) {
            bot.sendMessage(chatId,
                '❌ *Please provide a meme name*\n\n' +
                '📝 Example: `/blank Distracted Boyfriend`\n' +
                '💡 Try popular memes like: Chill guy, Epic handshake, Drake hotline bling, etc.',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const formattedMemeName = formatMemeNameForUrl(memeName);
        console.log("formatted memename", formattedMemeName);

        // Create inline keyboard
        const inlineKeyboard = {
            inline_keyboard: [
                [
                    {
                        text: '🖼️ View Examples',
                        callback_data: `view_examples_${chatId}`
                    },
                    {
                        text: '🔍 Full Meme Info',
                        callback_data: `full_info_${chatId}`
                    }
                ],
                [
                    {
                        text: '🔄 Get Another Blank',
                        callback_data: `new_blank_${chatId}`
                    }
                ]
            ]
        };

        // Step 1: Check local cache first (fastest)
        const cachedUrl = await memeCache.getBlankMeme(formattedMemeName);
        if (cachedUrl) {
            await bot.sendPhoto(chatId, cachedUrl, {
                caption: `🎨 *Blank Template: "${memeName}"*\n\n` +
                    `✨ *Create your own version:*\n` +
                    `🔗 ${MEME_URL}/${formattedMemeName}\n\n` +
                    `💡 *Tips:*\n` +
                    `• Right-click the image to save it\n` +
                    `• Use the link above to add custom text\n` +
                    `• Click buttons below for more options`,
                parse_mode: 'Markdown',
                reply_markup: inlineKeyboard
            });
            return;
        }

        const loadingMsg = await bot.sendMessage(chatId,
            '🔍 *Searching for blank template...*\n\n' +
            `📋 Looking up "${memeName}"...`,
            { parse_mode: 'Markdown' }
        );

        try {
            // Step 2: Check ImgFlip API cache (fast)
            console.log(`🚀 Step 1: Checking ImgFlip API cache for "${formattedMemeName}"`);
            const foundMeme = await memeCache.findMemeInCache(formattedMemeName);
            console.log("Found meme", foundMeme);

            if (foundMeme) {
                console.log(`✅ Found "${formattedMemeName}" in API cache as "${foundMeme.name}"`);

                // Cache the blank meme for future requests
                await memeCache.cacheBlankMeme(formattedMemeName, foundMeme.url);
                if (formattedMemeName.toLowerCase() !== foundMeme.name.toLowerCase()) {
                    await memeCache.cacheBlankMeme(foundMeme.name, foundMeme.url);
                }

                // Store context for inline keyboard actions
                await memeCache.setUserContext(chatId, {
                    memePageUrl: `https://imgflip.com/meme/${foundMeme.id}/${formatMemeNameForUrl(foundMeme.name)}`,
                    blankTemplateUrl: foundMeme.url,
                    memeName: foundMeme.name, // official name from API
                    currentPage: 1,
                    lastRequestTime: Date.now()
                });

                // Delete loading message and send result
                await bot.deleteMessage(chatId, loadingMsg.message_id);

                await bot.sendPhoto(chatId, foundMeme.url, {
                    caption: `🎨 *Blank Template: "${foundMeme.name}"*\n\n` +
                        `✨ *Create your own version:*\n` +
                        `🔗 ${MEME_URL}/${formatMemeNameForUrl(foundMeme.name)}\n\n` +
                        `💡 *Tips:*\n` +
                        `• Right-click the image to save it\n` +
                        `• Use the link above to add custom text\n` +
                        `• Click buttons below for more options`,
                    parse_mode: 'Markdown',
                    reply_markup: inlineKeyboard
                });
                return;
            }

            // Step 3: Fall back to web scraping (slower)
            console.log(`⚠️ "${memeName}" not found in API cache, falling back to web scraping`);

            await bot.editMessageText(
                `🔍 *Searching deeper...*\n\n` +
                `🕵️‍♂️ Meme not in quick database, checking web sources...`,
                {
                    chat_id: chatId,
                    message_id: loadingMsg.message_id,
                    parse_mode: 'Markdown'
                }
            );

            const browser = getBrowser();
            if (!browser) {
                await bot.editMessageText(
                    '🚀 *Bot is starting up...*\n\n' +
                    '⚙️ Initializing browser engine...\n' +
                    '⏳ Please try again in a moment!',
                    {
                        chat_id: chatId,
                        message_id: loadingMsg.message_id,
                        parse_mode: 'Markdown'
                    }
                );
                return;
            }

            let page: Page | undefined;
            try {
                page = await browser.newPage();
                const memeSearchResult = await searchMemeAndGetFirstLink(page, memeName);

                if (!memeSearchResult || !memeSearchResult.memeBlankImgUrl) {
                    await bot.editMessageText(
                        '❌ *Blank template not found*\n\n' +
                        `🔍 No blank template found for "${memeName}"\n\n` +
                        `💡 *Suggestions:*\n` +
                        `• Try a different meme name\n` +
                        `• Check spelling\n` +
                        `• Use popular meme names\n\n` +
                        `🎭 *Popular searches:* Drake, Distracted Boyfriend, This is Fine`,
                        {
                            chat_id: chatId,
                            message_id: loadingMsg.message_id,
                            parse_mode: 'Markdown'
                        }
                    );
                    return;
                }

                console.log("scraped blank result", memeSearchResult);

                // Cache the successful result for future quick access
                const extractedMemeName = extractMemeNameFromUrl(memeSearchResult.memeBlankImgUrl) as string;
                await memeCache.cacheBlankMeme(extractedMemeName, memeSearchResult.memeBlankImgUrl);

                // Store context for inline keyboard actions
                await memeCache.setUserContext(chatId, {
                    memePageUrl: memeSearchResult.memePageFullUrl,
                    blankTemplateUrl: memeSearchResult.memeBlankImgUrl,
                    memeName: extractedMemeName,
                    currentPage: 1,
                    lastRequestTime: Date.now()
                });

                // Delete the loading message
                await bot.deleteMessage(chatId, loadingMsg.message_id);

                // Send the blank template with rich caption
                await bot.sendPhoto(chatId, memeSearchResult.memeBlankImgUrl, {
                    caption: `🎨 *Blank Template: "${memeName}"*\n\n` +
                        `✨ *Create your own version:*\n` +
                        `🔗 ${MEME_URL}/${extractedMemeName}\n\n` +
                        `💡 *Tips:*\n` +
                        `• Right-click the image to save it\n` +
                        `• Use the link above to add custom text\n` +
                        `• Click buttons below for more options`,
                    parse_mode: 'Markdown',
                    reply_markup: inlineKeyboard
                });

            } finally {
                if (page) {
                    await page.close();
                    console.log(`Closed page for blank request from chat ID: ${chatId}`);
                }
            }

        } catch (error) {
            console.error('Error searching for blank meme:', error);
            await bot.editMessageText(
                '❌ *An error occurred while searching for the blank template*\n\n' +
                '🔧 Please try again or contact support if the issue persists',
                {
                    chat_id: chatId,
                    message_id: loadingMsg.message_id,
                    parse_mode: 'Markdown'
                }
            );
        }
    });
};
/**
 * Registers a listener for the /meme command to search for a meme and send
 * its origin story, summary, and images to the chat.
 *
 * @param {TelegramBot} bot - The Telegram bot instance.
 */
export const handleMemeCommand = (bot: TelegramBot) => {
    bot.onText(/^\/meme( (.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        let memeName = match?.[1];

        if (!memeName) {
            bot.sendMessage(chatId,
                '❌ *Please provide a meme name*\n\n' +
                '📝 Example: `/meme Distracted Boyfriend`\n' + 
                '💡 Try popular memes like: Chill guy, Epic handshake, etc.',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        memeName = formatMemeNameForUrl(memeName);

        // Check cache first
        const cachedMeme = await memeCache.getMeme(memeName);
        if (cachedMeme) {
            console.log(`⚡ Serving cached data for "${memeName}"`);

            // Send cached origin story first
            if (cachedMeme.originStory) {
                await bot.sendMessage(chatId, cachedMeme.originStory, { parse_mode: 'Markdown' });
            }

            // Send cached summary
            if (cachedMeme.summary) {
                await bot.sendMessage(chatId, cachedMeme.summary, { parse_mode: 'Markdown' });
            }

            // Send cached images
            if (cachedMeme.images && cachedMeme.images.length > 0) {
                await bot.sendMessage(chatId,
                    `🖼️ *Image Preview Collection* (${cachedMeme.images.length} images)\n\n` +
                    `📸 Here are some popular examples of this meme`,
                    { parse_mode: 'Markdown' }
                );

                for (let i = 0; i < cachedMeme.images.length; i++) {
                    const image = cachedMeme.images[i];
                    try {
                        const caption = `🎭 *Example ${i + 1}/${cachedMeme.images.length}*\n\n` +
                            `${image.alt.replace(/"/g, '').substring(0, 200)}` +
                            (image.alt.length > 200 ? '...' : '');

                        await bot.sendPhoto(chatId, image.src, {
                            caption,
                            parse_mode: 'Markdown'
                        });

                        if (i < cachedMeme.images.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    } catch (error) {
                        console.error(`Error sending cached image ${i + 1}:`, error);
                    }
                }
            } else {
                await bot.sendMessage(chatId,
                    '📷 *No suitable images found for preview*\n\n' +
                    'But you can use the blank template and source page links above! 🎨'
                );
            }

            // Send final completion message with inline keyboard
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
                            text: '✨ Create Your Own',
                            url: `${MEME_URL}/${formatMemeNameForUrl(memeName)}`
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

            // Set user context for inline keyboard functionality
            await memeCache.setUserContext(chatId, {
                memePageUrl: cachedMeme.memePageUrl,
                blankTemplateUrl: cachedMeme.blankTemplateUrl,
                memeName: memeName,
                currentPage: 1,
                lastRequestTime: Date.now()
            });

            const popularMemes = await memeCache.getPopularMemes();
            const tipMessage = popularMemes.length > 0
                ? `💡 *Popular searches:* ${popularMemes.join(', ')}`
                : `💡 *Popular searches:* Drake, Distracted Boyfriend, This is Fine`;

            await bot.sendMessage(chatId,
                '✅ *Meme search completed successfully!* ✅\n\n' +
                '🎨 Use the blank template to create your own\n' +
                '✨ Click "Create Your Own" to edit online\n' +
                '🔄 Search for another meme with `/meme [name]`\n\n' +
                tipMessage,
                {
                    parse_mode: 'Markdown',
                    reply_markup: inlineKeyboard
                }
            );

            return;
        }

        // For /meme command, prepend the meme name to the imgflip URL and use direct scraping
        // const directUrl = `https://imgflip.com/meme/${formatMemeNameForUrl(memeName)}`;
        // console.log(`🎯 Using direct URL for /meme command: ${directUrl}`);

        await triggerFullMemeSearchDirect(bot, chatId, memeName);
    });
};

// Helper function for direct meme search (optimized for /meme command)
const triggerFullMemeSearchDirect = async (bot: TelegramBot, chatId: number, memeName: string) => {
    const browser = getBrowser();
    if (!browser) {
        await bot.sendMessage(chatId,
            '🚀 *Bot is starting up...*\n\n' +
            '⚙️ Initializing browser engine...\n' +
            '⏳ Please try again in a moment!',
            { parse_mode: 'Markdown' }
        );
        return;
    }

    const initialMessage = await bot.sendMessage(chatId,
        '🚀 *Starting direct meme search...*\n\n' +
        `📋 Analyzing "${memeName}" directly from ImgFlip...`
    );

    const tracker: ProgressTracker = {
        chatId,
        messageId: initialMessage.message_id,
        currentStep: 1,
        totalSteps: 4, // Reduced steps for direct approach
        startTime: Date.now()
    };

    const progressInterval = setInterval(async () => {
        if (tracker.currentStep < tracker.totalSteps) {
            tracker.currentStep++;
            const progressMessages = [
                '🔍 *Accessing meme page directly...*',
                '📚 *Gathering origin story...*',
                '🖼️ *Collecting image examples...*',
                '✅ *Finalizing results...*'
            ];
            await updateProgress(bot, tracker, progressMessages[tracker.currentStep - 1]);
        }
    }, 8000);

    let page: Page | undefined;
    try {
        page = await browser.newPage();
        console.log(`Opened new page for direct meme request from chat ID: ${chatId}`);

        const responseHandler = {
            page,
            async sendUpdate(text: string) {
                try {
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
                const relevantImages = images.filter(img =>
                    img.src.includes('http'));

                if (relevantImages.length === 0) {
                    await bot.sendMessage(chatId,
                        '📷 *No suitable images found for preview*\n\n' +
                        'But you can use the blank template and source page links above! 🎨'
                    );
                    return;
                }

                await bot.sendMessage(chatId,
                    `🖼️ *Image Preview Collection* (${relevantImages.length} images)\n\n` +
                    `📸 Here are some popular examples of this meme`,
                    { parse_mode: 'Markdown' }
                );


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
                                text: '✨ Create Your Own',
                                url: `${MEME_URL}/${formatMemeNameForUrl(memeName)}`
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

                const popularMemes = await memeCache.getPopularMemes();
                const tipMessage = popularMemes.length > 0
                    ? `💡 *Popular searches:* ${popularMemes.join(', ')}`
                    : `💡 *Popular searches:* Drake, Distracted Boyfriend, This is Fine`;

                await bot.sendMessage(chatId,
                    '✅ *Meme search completed successfully!* ✅\n\n' +
                    '🎨 Use the blank template to create your own\n' +
                    '✨ Click "Create Your Own" to edit online\n' +
                    '🔄 Search for another meme with `/meme [name]`\n\n' +
                    tipMessage,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: inlineKeyboard
                    }
                );
            }
        };

        // Use the meme agent with direct URL flag set to true
        const response = await runMemeAgent(memeName, responseHandler, `meme_${Date.now()}`, true);

        if (response && response.memePageUrl && response.blankMemeUrl) {
            console.log("Caching result for /meme");
            // Cache the successful result
            await memeCache.cacheMeme(memeName, {
                memePageUrl: response.memePageUrl,
                blankTemplateUrl: response.blankMemeUrl,
                memeName: memeName,
                currentPage: 1,
                lastRequestTime: Date.now(),
                images: response.images,
                originStory: response.originStory,
                summary: response.summary,
            });

            await memeCache.setUserContext(chatId, {
                memePageUrl: response.memePageUrl,
                blankTemplateUrl: response.blankMemeUrl,
                memeName: memeName,
                currentPage: 1,
                lastRequestTime: Date.now()
            });
        }

        clearInterval(progressInterval);

        tracker.currentStep = tracker.totalSteps;
        await updateProgress(bot, tracker, "✅ Direct search completed successfully!", "🎉");

    } catch (error) {
        console.error("Error processing direct meme request:", error);

        clearInterval(progressInterval);

        await bot.editMessageText(
            '❌ *Oops! Something went wrong* ❌\n\n' +
            '🔧 There was an issue processing your request\n' +
            '💡 The meme might not exist or there could be a connectivity issue\n\n' +
            '🆘 Try with a different meme name or use `/blank` for faster results',
            {
                chat_id: tracker.chatId,
                message_id: tracker.messageId,
                parse_mode: 'Markdown'
            }
        );
        return;
    } finally {
        if (page) {
            await page.close();
            console.log(`Closed page for direct meme request from chat ID: ${chatId}`);
        }
    }
};

export const handleCallbackQuery = (bot: TelegramBot) => {
    bot.on('callback_query', async (callbackQuery) => {
        const msg = callbackQuery.message;
        const data = callbackQuery.data;
        const chatId = msg?.chat.id;

        if (!chatId || !data) {
            await bot.answerCallbackQuery(callbackQuery.id, { text: "Invalid request" });
            return;
        }

        try {
            await bot.answerCallbackQuery(callbackQuery.id);

            const extractedChatId = parseInt(data.split('_').pop() || '0');
            if (isNaN(extractedChatId) || extractedChatId !== chatId) {
                console.warn(`Callback query for chat ${extractedChatId} does not match current chat ${chatId}`);
                return;
            }

            if (data.startsWith('view_examples_')) {
                const context = await memeCache.getUserContext(chatId);
                if (!context) {
                    await bot.sendMessage(chatId, '❌ *Context not available*\n\nPlease search for a meme first.', { parse_mode: 'Markdown' });
                    return;
                }

                const loadingMsg = await bot.sendMessage(chatId, `🔍 *Loading examples for "${context.memeName}"*`, { parse_mode: 'Markdown' });

                const browser = getBrowser();
                if (!browser) {
                    await bot.editMessageText('❌ Browser not available.', { chat_id: chatId, message_id: loadingMsg.message_id });
                    return;
                }

                let page: Page | undefined;
                try {
                    page = await browser.newPage();
                    const { scrapeMemeImagesFromPage } = await import('../../meme-generator/tools/meme-generator-tools.js');
                    const images = await scrapeMemeImagesFromPage(page, context.memePageUrl);
                    await bot.deleteMessage(chatId, loadingMsg.message_id);

                    if (!images || images.length === 0) {
                        await bot.sendMessage(chatId, `❌ *No examples found for "${context.memeName}"*`, { parse_mode: 'Markdown' });
                        return;
                    }

                    const relevantImages = images.filter(img => img.src.includes('http')).slice(0, 10);
                    await bot.sendMessage(chatId, `🖼️ *Examples of "${context.memeName}"* (${relevantImages.length} images)`);

                    for (let i = 0; i < relevantImages.length; i++) {
                        const image = relevantImages[i];
                        try {
                            const caption = `🎭 *Example ${i + 1}/${relevantImages.length}*\n\n${image.alt.replace(/"/g, '').substring(0, 200)}`;
                            await bot.sendPhoto(chatId, image.src, { caption, parse_mode: 'Markdown' });
                            if (i < relevantImages.length - 1) await new Promise(resolve => setTimeout(resolve, 1000));
                        } catch (error) {
                            console.error(`Error sending example image ${i + 1}:`, error);
                        }
                    }
                } catch (error) {
                    console.error('Error loading examples:', error);
                    await bot.editMessageText('❌ *Error loading examples*', { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: 'Markdown' });
                } finally {
                    if (page) await page.close();
                }

            } else if (data.startsWith('full_info_')) {
                const context = await memeCache.getUserContext(chatId);
                if (!context) {
                    await bot.sendMessage(chatId, '❌ *Context not available*\n\nPlease search for a meme first.', { parse_mode: 'Markdown' });
                    return;
                }
                await bot.sendMessage(chatId, `🔍 *Getting full information for "${context.memeName}"*`, { parse_mode: 'Markdown' });
                await memeCache.deleteUserContext(chatId);
                await triggerFullMemeSearchDirect(bot, chatId, context.memeName);

            } else if (data.startsWith('new_blank_')) {
                await bot.sendMessage(chatId, '🔍 *Ready for another blank template search!*\n\nUse `/blank [name]`', { parse_mode: 'Markdown' });

            } else if (data.startsWith('blank_template_')) {
                const context = await memeCache.getUserContext(chatId);
                if (!context) {
                    await bot.sendMessage(chatId, '❌ *Template not available*\n\nPlease search for a meme first.', { parse_mode: 'Markdown' });
                    return;
                }
                await bot.sendPhoto(chatId, context.blankTemplateUrl, {
                    caption: `🎨 *Blank Template for "${context.memeName}"*\n\n` +
                             `✨ *Create your own version:*
` +
                             `🔗 ${MEME_URL}/${formatMemeNameForUrl(context.memeName)}`,
                    parse_mode: 'Markdown'
                });

            } else if (data.startsWith('more_templates_')) {
                const context = await memeCache.getUserContext(chatId);
                if (!context) {
                    await bot.sendMessage(chatId, '❌ *Additional templates not available*\n\nPlease search for a meme first.', { parse_mode: 'Markdown' });
                    return;
                }

                const currentPage = context.currentPage ? context.currentPage + 1 : 2;
                context.currentPage = currentPage;
                await memeCache.setUserContext(chatId, context);

                const loadingMsg = await bot.sendMessage(chatId, `🔍 *Loading templates from page ${currentPage}...*`, { parse_mode: 'Markdown' });

                const browser = getBrowser();
                if (!browser) {
                    await bot.editMessageText('❌ Browser not available.', { chat_id: chatId, message_id: loadingMsg.message_id });
                    return;
                }

                let page: Page | undefined;
                try {
                    page = await browser.newPage();
                    const nextPageUrl = constructPageUrl(context.memePageUrl, currentPage);
                    const { scrapeMemeImagesFromPage } = await import('../../meme-generator/tools/meme-generator-tools.js');
                    const moreImages = await scrapeMemeImagesFromPage(page, nextPageUrl);

                    if (!moreImages || moreImages.length === 0) {
                        context.currentPage = Math.max(1, currentPage - 1);
                        await memeCache.setUserContext(chatId, context);
                        await bot.editMessageText(`📄 *No more templates found on page ${currentPage}*`, { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: 'Markdown' });
                        return;
                    }

                    await bot.editMessageText(`✅ Found ${moreImages.length} templates on page ${currentPage}!`, { chat_id: chatId, message_id: loadingMsg.message_id });

                    const relevantImages = moreImages.filter(img => img.src.includes('http'));
                    if (relevantImages.length > 0) {
                        await bot.sendMessage(chatId, `🔍 *Page ${currentPage} Templates* (${relevantImages.length} images)`);

                        for (let i = 0; i < relevantImages.length; i++) {
                            const image = relevantImages[i];
                            try {
                                const caption = `🎭 *Page ${currentPage} - Example ${i + 1}/${relevantImages.length}*\n\n${image.alt.replace(/"/g, '').substring(0, 200)}`;
                                await bot.sendPhoto(chatId, image.src, { caption, parse_mode: 'Markdown' });
                                if (i < relevantImages.length - 1) await new Promise(resolve => setTimeout(resolve, 1000));
                            } catch (error) {
                                console.error(`Error sending image ${i + 1} from page ${currentPage}:`, error);
                            }
                        }

                        const continueKeyboard = {
                            inline_keyboard: [
                                [
                                    { text: '🎨 Get Blank Template', callback_data: `blank_template_${chatId}` },
                                    { text: `🔍 Page ${currentPage + 1} →`, callback_data: `more_templates_${chatId}` }
                                ],
                                [
                                    { text: '✨ Create Your Own', url: `${MEME_URL}/${formatMemeNameForUrl(context.memeName)}` }
                                ],
                                [
                                    { text: '🔄 Search Another Meme', callback_data: `new_search_${chatId}` },
                                    { text: '🔙 Back to Page 1', callback_data: `reset_pages_${chatId}` }
                                ]
                            ]
                        };
                        await bot.sendMessage(chatId, `📋 *Page ${currentPage} loaded!*`, { parse_mode: 'Markdown', reply_markup: continueKeyboard });
                    }
                } catch (error) {
                    console.error(`Error loading page ${currentPage}:`, error);
                    context.currentPage = Math.max(1, currentPage - 1);
                    await memeCache.setUserContext(chatId, context);
                    await bot.editMessageText(`❌ *Error loading page ${currentPage}*`, { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: 'Markdown' });
                } finally {
                    if (page) await page.close();
                }

            } else if (data.startsWith('reset_pages_')) {
                const context = await memeCache.getUserContext(chatId);
                if (context) {
                    context.currentPage = 1;
                    await memeCache.setUserContext(chatId, context);
                    await bot.sendMessage(chatId, `🔙 *Reset to Page 1*`, { parse_mode: 'Markdown' });
                }

            } else if (data.startsWith('new_search_')) {
                await memeCache.deleteUserContext(chatId);
                await bot.sendMessage(chatId, '🔍 *Ready for a new search!*\n\nUse `/meme [name]` or `/blank [name]`', { parse_mode: 'Markdown' });
            }

        } catch (error) {
            console.error('Error handling callback query:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: "Something went wrong. Please try again.", show_alert: true });
        }
    });
};
