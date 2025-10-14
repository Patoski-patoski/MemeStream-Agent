// src/bot/core/handlers.ts
import TelegramBot from 'node-telegram-bot-api';
import { Page } from 'playwright';
import { getBrowser } from './browser.js';
import { findMemeByDescription } from '../../meme-generator/agents/memeFinderAgent.js';
import { runMemeAgent } from '../../meme-generator/agents/memegeneratorAgent.js';
import { scrapeMemeImagesFromPage } from '../../meme-generator/tools/meme-generator-tools.js';
import { ProgressTracker, MemeContext } from '../types/types.js';
import { formatMemeNameForUrl } from '../utils/formatters.js';
import {
    updateProgress,
    constructPageUrl
} from '../utils/utils.js';
import { memeCache } from './cache.js';
import { addMemeJob } from './queue.js';
import { getBlankMemeFromApi } from '../../meme-generator/api/imgflip.js';

const MEME_URL = process.env.MEME_URL;

/**
 * Sets the bot commands menu.
 *
 * This function sets the bot commands menu with the following commands:
 *
 * - `/start`: Welcome message and bot introduction
 * - `/meme <meme name>`: Full meme search with history and examples
 * - `/blank <meme name>`: Get blank meme template instantly
 * - `/help`: Show help and usage instructions
 *
 * The commands are set for all private chats and all group chats.
 *
 * @param {TelegramBot} bot - The Telegram bot instance.
 * @returns {Promise<void>}
 */
/**
 * Sets the bot commands menu with the new /find command
 */
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
                command: 'find',
                description: '🤖 Describe a meme to find matching templates'
            },
            {
                command: 'help',
                description: '❓ Show help and usage instructions'
            }
        ];

        await bot.setMyCommands(commands);
        console.log('✅ Bot commands menu set successfully!');

        // For private chats
        await bot.setMyCommands(commands, {
            scope: { type: 'all_private_chats' }
        });

        // For group chats
        await bot.setMyCommands(commands, {
            scope: { type: 'all_group_chats' }
        });

    } catch (error) {
        console.error('❌ Error setting bot commands:', error);
    }
};


/**
 * Registers a listener for the /start command to display a welcome message
 * with available commands, examples, and tips.
 * @param {TelegramBot} bot - The Telegram bot instance.
 */
export const handleStartCommand = (bot: TelegramBot) => {
    bot.onText(/^\/start$/, (msg) => {
        const chatId = msg.chat.id;
        const firstName = msg.from?.first_name;

        let welcomeMessage = '🎭 *Welcome to Meme Generator Bot!* 🎭\n\n';
        if (firstName) {
            welcomeMessage = `🎭 *Welcome, ${firstName}, to Meme Generator Bot!* 🎭\n\n`;
        }

        bot.sendMessage(chatId,
            welcomeMessage +
            '🚀 I can help you find any meme and its history!\n\n' +
            '📝 *Commands:*' +
            '• `/meme [name]` - Full meme search with history' +
            '• `/blank [name]` - Get blank template only\n\n' +
            '💡 *Examples:*' +
            '• `/meme Distracted Boyfriend`' +
            '• `/blank Drake hotline bling`\n\n' +
            '⏱️ *Please note:* Full searches take 15-20 seconds, blank templates are instant!',
            { parse_mode: 'Markdown' }
        );
    });
};

/**
 * Registers a listener for the /help command to display a help message
 * with available commands, examples, and tips.
 * @param {TelegramBot} bot - The Telegram bot instance.
 */



/**
 * Updated help command with /find information
 */
export const handleHelpCommand = (bot: TelegramBot) => {
    bot.onText(/^\/help$/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId,
            '🤖 *Meme Generator Bot Help* 🤖\n\n' +
            '📝 *Available Commands:*\n\n' +
            '🎭 `/start` - Welcome message and introduction\n\n' +
            
            '🔍 `/meme [name]` - Full meme search with history\n' +
            '   • Example: `/meme Distracted Boyfriend`\n' +
            '   • Includes origin story, history, examples\n' +
            '   • Takes 15-20 seconds for complete results\n\n' +
            
            '🎨 `/blank [name]` - Get blank template instantly\n' +
            '   • Example: `/blank Drake hotline bling`\n' +
            '   • Quick access to customizable templates\n' +
            '   • Instant results with editing links\n\n' +
            
            '🤖 `/find [description]` - Describe a meme to find it\n' +
            '   • Example: `/find spiderman pointing at each other`\n' +
            '   • AI-powered search by description\n' +
            '   • Perfect when you don\'t know the meme name\n' +
            '   • Returns multiple matching templates\n\n' +
            
            '❓ `/help` - Show this help message\n\n' +
            
            '💡 *Popular Memes to Try:*\n' +
            '• Drake hotline bling\n' +
            '• Distracted Boyfriend\n' +
            '• This is Fine\n' +
            '• Expanding Brain\n' +
            '• Chill guy\n' +
            '• Two buttons\n' +
            '• Epic handshake\n\n' +
            
            '🎯 *Tips:*\n' +
            '• Use `/find` when you don\'t know the meme name\n' +
            '• Use `/blank` for quick templates\n' +
            '• Use `/meme` for complete meme information\n' +
            '• Check spelling if meme not found\n' +
            '• Try alternative meme names\n\n' +
            
            '🔗 *Need more help?* Contact @tnemyojne',
            { parse_mode: 'Markdown' }
        );
    });
};

// src/bot/core/handlers.ts - Add this new handler

/**
 * Handles the /find command, which uses AI to interpret a meme description
 * and returns matching blank templates from the cached API.
 * @param {TelegramBot} bot - The Telegram bot instance.
 */
export const handleFindMemeCommand = (bot: TelegramBot) => {
    bot.onText(/^\/find( (.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const memeDescription = match?.[2];

        if (!memeDescription) {
            bot.sendMessage(chatId,
                '🔍 *Describe the meme you\'re looking for!*\n\n' +
                '📝 *Examples:*\n' +
                '• `/find That meme where spiderman points at each other`\n' +
                '• `/find Guy choosing between two buttons`\n' +
                '• `/find Drake approving and disapproving`\n' +
                '• `/find Distracted boyfriend looking at another girl`\n\n' +
                '💡 *Tip:* Describe what you see in the meme!',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const loadingMsg = await bot.sendMessage(chatId,
            '🤖 *Analyzing your description...*\n\n' +
            `🔍 Searching for: "${memeDescription}"\n` +
            '⏳ This might take a moment...',
            { parse_mode: 'Markdown' }
        );

        try {
            // Use the findMemeByDescription agent
            const foundMemes = await findMemeByDescription(chatId, memeDescription);

            // Delete loading message
            await bot.deleteMessage(chatId, loadingMsg.message_id);

            if (!foundMemes || foundMemes.length === 0) {
                await bot.sendMessage(chatId,
                    '❌ *No matching memes found*\n\n' +
                    `I couldn't find any memes matching: "${memeDescription}"\n\n` +
                    '💡 *Try:*\n' +
                    '• Using more specific details\n' +
                    '• Describing the visual elements\n' +
                    '• Mentioning popular characters or scenarios\n\n' +
                    '🔄 Use `/find [description]` to try again',
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            // If multiple memes found, show all options
            if (foundMemes.length > 1) {
                await bot.sendMessage(chatId,
                    `🎯 *Found ${foundMemes.length} matching memes!*\n\n` +
                    `Here are the templates that match your description:`,
                    { parse_mode: 'Markdown' }
                );

                // Send each matching meme
                for (let i = 0; i < Math.min(foundMemes.length, 5); i++) {
                    const meme = foundMemes[i];

                    const inlineKeyboard = {
                        inline_keyboard: [
                            [
                                { text: '🖼️ View Examples', callback_data: `view_examples_${chatId}` },
                                { text: '🔍 Full Info', callback_data: `full_info_${chatId}` }
                            ],
                            [
                                { text: '✨ Create Meme', url: `${MEME_URL}/${formatMemeNameForUrl(meme.name)}` }
                            ]
                        ]
                    };

                    // Set context for each meme
                    await memeCache.setUserContext(chatId, {
                        memePageUrl: `https://imgflip.com/meme/${meme.id}/${formatMemeNameForUrl(meme.name)}`,
                        blankTemplateUrl: meme.url,
                        memeName: meme.name,
                        memeId: meme.id,
                        currentPage: 1,
                        lastRequestTime: Date.now()
                    });

                    await bot.sendPhoto(chatId, meme.url, {
                        caption:
                            `🎨 *Match ${i + 1}/${Math.min(foundMemes.length, 5)}: "${meme.name}"*\n\n` +
                            `📊 *Popularity:* ${meme.captions?.toLocaleString() || 'N/A'} uses\n` +
                            `📐 *Dimensions:* ${meme.width}x${meme.height}\n` +
                            `💬 *Text boxes:* ${meme.box_count}\n\n` +
                            `✨ *Create your version:* [Click here](${MEME_URL}/${formatMemeNameForUrl(meme.name)})`,
                        parse_mode: 'Markdown',
                        reply_markup: inlineKeyboard
                    });

                    // Small delay between messages
                    if (i < Math.min(foundMemes.length, 5) - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }

                if (foundMemes.length > 5) {
                    await bot.sendMessage(chatId,
                        `📋 *Note:* Showing top 5 of ${foundMemes.length} matches\n\n` +
                        '💡 *Tip:* Use a more specific description to narrow results',
                        { parse_mode: 'Markdown' }
                    );
                }

            } else {
                // Single meme found - perfect match!
                const meme = foundMemes[0];

                const inlineKeyboard = {
                    inline_keyboard: [
                        [
                            { text: '🖼️ View Examples', callback_data: `view_examples_${chatId}` },
                            { text: '🔍 Full Meme Info', callback_data: `full_info_${chatId}` }
                        ],
                        [
                            { text: '✨ Create Your Own', url: `${MEME_URL}/${formatMemeNameForUrl(meme.name)}` }
                        ],
                        [
                            { text: '🔄 Find Another', callback_data: `new_search_${chatId}` }
                        ]
                    ]
                };

                // Set context
                await memeCache.setUserContext(chatId, {
                    memePageUrl: `https://imgflip.com/meme/${meme.id}/${formatMemeNameForUrl(meme.name)}`,
                    blankTemplateUrl: meme.url,
                    memeName: meme.name,
                    memeId: meme.id,
                    currentPage: 1,
                    lastRequestTime: Date.now()
                });

                await bot.sendPhoto(chatId, meme.url, {
                    caption:
                        `🎯 *Perfect Match: "${meme.name}"*\n\n` +
                        `📊 *Popularity:* ${meme.captions?.toLocaleString() || 'N/A'} uses\n` +
                        `📐 *Dimensions:* ${meme.width}x${meme.height}\n` +
                        `💬 *Text boxes:* ${meme.box_count}\n\n` +
                        `✨ *Create your version:* [Click here](${MEME_URL}/${formatMemeNameForUrl(meme.name)})\n\n` +
                        `💡 *Want more info?* Click "Full Meme Info" below!`,
                    parse_mode: 'Markdown',
                    reply_markup: inlineKeyboard
                });
            }

        } catch (error) {
            console.error('Error in /find command:', error);

            await bot.editMessageText(
                '❌ *Search failed*\n\n' +
                '🔧 Something went wrong while searching for memes\n\n' +
                '💡 *Try:*\n' +
                '• Simplifying your description\n' +
                '• Using different keywords\n' +
                '• Checking your internet connection\n\n' +
                '🔄 Use `/find [description]` to try again',
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
 * Handles the /blank command, which provides a blank meme template for the specified meme name.
 * If no meme name is provided, asks the user to provide one.
 * If the meme name is not found in the database, falls back to web scraping.
 * If the meme is found, sends the blank template with a rich caption.
 * Stores context for inline keyboard actions.
 */
export const handleBlankMemeCommand = (bot: TelegramBot) => {
    bot.onText(/^\/blank( (.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const memeName = match?.[2];

        if (!memeName) {
            bot.sendMessage(chatId,
                '❌ *Please provide a meme name*\n\n' +
                '📝 Example: `/blank Distracted Boyfriend`\n' +
                '💡 Try popular memes like: Chill guy, Epic handshake, Drake hotline bling, etc.',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const loadingMsg = await bot.sendMessage(chatId,
            '🎨✨ *Summoning your template...*\n\n' +
            `Hold on tight while I find the perfect canvas for "${memeName}"!`,
            { parse_mode: 'Markdown' }
        );

        try {
            await getBlankMemeFromApi(chatId, memeName);
            await bot.deleteMessage(chatId, loadingMsg.message_id);
        } catch (error) {
            console.error('Error getting blank meme from API:', error);
            // The user is already notified by the getBlankMemeFromApi function
        }
    });
};
/**
 * Registers a listener for the /meme command to search for a meme and send
 * its origin story, summary, and images to the chat.
 *
 * @param {TelegramBot} bot - The Telegram bot instance.
 */
/**
 * Registers a listener for the /meme command to search for a meme and send
 * its origin story, summary, and images to the chat.
 *
 * @param {TelegramBot} bot - The Telegram bot instance.
 */
export const handleMemeCommand = (bot: TelegramBot) => {
    bot.onText(/^\/meme( (.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        let memeName = match?.[2];

        if (!memeName) {
            bot.sendMessage(chatId,
                '❌ *Please provide a meme name*\n\n' +
                '📝 Example: `/meme Distracted Boyfriend`\n' +
                '💡 Try popular memes like: Two buttons, Epic handshake, etc.',
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
                            url: `${MEME_URL}/${formatMemeNameForUrl(cachedMeme.memeName)}`
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
                `🏁 *And that's a wrap on "${memeName}"!* 🏁\n\n` +
                `You're now an expert. What's next?\n\n` +
                `🎨 *Get Creative:* Grab the blank template.\n` +
                `🌐 *Easy Mode:* [Click here to caption it online](${cachedMeme.memePageUrl})` +
                `🔄 *Another Round?:* Use /meme [new name]\n` +
                tipMessage,
                {
                    parse_mode: 'Markdown',
                    reply_markup: inlineKeyboard
                }
            );

            return;
        }

        // If not cached, check if we can find it in the ImgFlip API cache first
        const foundMeme = await memeCache.findMemeInCache(memeName);
        if (foundMeme) {
            console.log(`🚀 Found "${memeName}" in API cache as "${foundMeme.name}" (ID: ${foundMeme.id})`);

            // Create context from the API-found meme
            const memeContext: MemeContext = {
                memePageUrl: `https://imgflip.com/meme/${foundMeme.id}/${formatMemeNameForUrl(foundMeme.name)}`,
                blankTemplateUrl: foundMeme.url,
                memeName: foundMeme.name,
                memeId: foundMeme.id,
                currentPage: 1,
                lastRequestTime: Date.now()
            };

            console.log(`Created context with URL: ${memeContext.memePageUrl}`);
            console.log(`BlankMeme context with URL: ${memeContext.blankTemplateUrl}`);


            // Set context for user
            await memeCache.setUserContext(chatId, memeContext);

            // Use the context-based search with the correct URL
            await triggerFullMemeSearchWithContext(bot, chatId, memeContext);
            return;
        }

        // If not in API cache, fall back to the original direct search
        const loadingMsg = await bot.sendMessage(chatId,
            '🚀 *Starting full meme search...*\n\n' +
            'This might take a moment, I will send the results when ready!',
            { parse_mode: 'Markdown' }
        );

        try {
            await addMemeJob('full-search', {
                chatId,
                memeName,
                loadingMessageId: loadingMsg.message_id,
                jobType: 'full'
            });
        } catch (error) {
            console.error('Error adding full meme job to queue:', error);

            if (error instanceof Error && error.message.includes('Rate limit')) {
                await bot.editMessageText(
                    '🚦 *Rate limit exceeded!*\n\n' +
                    `${error.message}\n\n` +
                    '💡 *Tip:* Use `/blank [name]` for faster results.',
                    {
                        chat_id: chatId,
                        message_id: loadingMsg.message_id,
                        parse_mode: 'Markdown'
                    }
                );
            } else {
                await bot.editMessageText(
                    '❌ *Failed to start meme search*\n\n' +
                    '🔧 Please try again or use `/blank [name]` for quick templates',
                    {
                        chat_id: chatId,
                        message_id: loadingMsg.message_id,
                        parse_mode: 'Markdown'
                    }
                );
            }
        }
    });
};


// Helper function for direct meme search (optimized for /meme command)
// Add this new helper function to src/bot/core/handlers.ts

/**
 * Triggers full meme search using existing context URL instead of reconstructing
 */
// Add this new helper function to src/bot/core/handlers.ts

/**
 * Triggers full meme search using existing context URL instead of reconstructing
 */
const triggerFullMemeSearchWithContext = async (bot: TelegramBot, chatId: number, context: MemeContext) => {
    const browser = getBrowser();
    if (!browser) {
        await bot.sendMessage(chatId,
            '🚀 *Bot is starting up...\n\n*' +
            '⚙️ Initializing browser engine...\n\n' +
            '⏳ Please try again in a moment!',
            { parse_mode: 'Markdown' }
        );
        return;
    }

    const initialMessage = await bot.sendMessage(chatId,
        '🚀 *Starting direct meme search...*\n\n' +
        `📋 Analyzing "${context.memeName}" from existing context...`
    );

    const tracker: ProgressTracker = {
        chatId,
        messageId: initialMessage.message_id,
        currentStep: 1,
        totalSteps: 4,
        startTime: Date.now()
    };

    const progressInterval = setInterval(async () => {
        if (tracker.currentStep < tracker.totalSteps) {
            tracker.currentStep++;
            const progressMessages = [
                '🔍 *Using existing meme URL...*',
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
        console.log(`Opened new page for context-based meme request from chat ID: ${chatId}`);

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

                // Send completion message after images
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
                                url: `${MEME_URL}/${formatMemeNameForUrl(context.memeName)}` // Use context URL
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
                    `🏁 *And that's a wrap on "${context.memeName}"!* 🏁\n\n` +
                    `You're now an expert. What's next?\n\n` +
                    `🎨 *Get Creative:* Grab the blank template.\n` +
                    `🌐 *Easy Mode:* [Click here to caption it online](${context.memePageUrl})
` +
                    `🔄 *Another Round?:* Use /meme [new name]\n\n` +
                    tipMessage,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: inlineKeyboard
                    }
                );
            }
        };

        // CRITICAL FIX: Use the existing context.memePageUrl directly
        console.log(`Using existing context URL: ${context.memePageUrl}`);

        // Extract the full meme path (ID/Name) from the existing context URL
        const urlParts = context.memePageUrl.split('/meme/');
        let memeFullPath = urlParts.length > 1 ? urlParts[1] : context.memeName;

        // Additional safety check - ensure we have the full path
        if (!memeFullPath.includes('/') && context.memeId) {
            // If we don't have a slash but we have memeId, construct it properly
            memeFullPath = `${context.memeId}/${formatMemeNameForUrl(context.memeName)}`;
        }

        console.log(`Extracted meme path for agent: ${memeFullPath}`);
        console.log(`Full URL that will be used: https://imgflip.com/meme/${memeFullPath}`);

        const response = await runMemeAgent(memeFullPath, responseHandler, `meme_${Date.now()}`, true);

        if (response && response.memePageUrl && response.blankMemeUrl) {
            console.log("Caching result for context-based full info");
            // Cache the successful result with the correct URL from context
            await memeCache.cacheMeme(context.memeName, {
                memePageUrl: context.memePageUrl, // Use the correct URL from context
                blankTemplateUrl: response.blankMemeUrl,
                memeName: context.memeName,
                currentPage: 1,
                lastRequestTime: Date.now(),
                images: response.images,
                originStory: response.originStory,
                summary: response.summary,
            });

            // Update context with the same correct URL
            await memeCache.setUserContext(chatId, {
                ...context,
                memePageUrl: context.memePageUrl, // Keep the original correct URL
                blankTemplateUrl: response.blankMemeUrl,
                lastRequestTime: Date.now()
            });
        }

        clearInterval(progressInterval);
        tracker.currentStep = tracker.totalSteps;
        await updateProgress(bot, tracker, "✅ Context-based search completed successfully!", "🎉");

    } catch (error) {
        console.error("Error processing context-based meme request:", error);

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
            console.log(`Closed page for context-based meme request from chat ID: ${chatId}`);
        }
    }
};
/**
 * Registers a listener for callback queries to handle user interactions
 * with the bot, such as viewing examples, getting full information, or
 * requesting a blank template.
 * @param {TelegramBot} bot - The Telegram bot instance.
 */
// Updated handleCallbackQuery function in src/bot/core/handlers.ts
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

            const parts = data.split('_');
            const command = parts[0];
            const action = parts[1];
            // const memeId = parts[2];
            const extractedChatId = parseInt(parts.pop() || '0');

            if (isNaN(extractedChatId) || extractedChatId !== chatId) {
                console.warn(`Callback query for chat ${extractedChatId} does not match current chat ${chatId}`);
                return;
            }

            if (command === 'view' && action === 'examples') {
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
                    const images = await scrapeMemeImagesFromPage(page, context.memePageUrl);

                    if (!images || images.length === 0) {
                        await bot.sendMessage(chatId, `❌ *No examples found for "${context.memeName}"*`, { parse_mode: 'Markdown' });
                        return;
                    }

                    const relevantImages = images.filter(img => img.src.includes('http')).slice(0, 10);
                    await bot.sendMessage(chatId, `🖼️ *Examples of "${context.memeName}"* (${relevantImages.length} images)`);

                    for (let i = 0; i < relevantImages.length; i++) {
                        const image = relevantImages[i];
                        try {
                            const caption = `🎭 *Example ${i + 1}/${relevantImages.length}*

${image.alt.replace(/"/g, '').substring(0, 200)}`;
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

            } else if (command === 'full' && action === 'info') {
                const context = await memeCache.getUserContext(chatId);
                if (!context) {
                    await bot.sendMessage(chatId, '❌ *Context not available*\n\nPlease search for a meme first.', { parse_mode: 'Markdown' });
                    return;
                }
                await bot.sendMessage(chatId, `🔍 *Getting full information for "${context.memeName}"*`, { parse_mode: 'Markdown' });

                // FIXED: Pass the existing memePageUrl directly instead of reconstructing
                await triggerFullMemeSearchWithContext(bot, chatId, context);

            } else if (command === 'new' && action === 'blank') {
                await bot.sendMessage(chatId, '🔍 *Ready for another blank template search!*\n\nUse `/blank [name]`', { parse_mode: 'Markdown' });

            } else if (command === 'blank' && action === 'template') {
                const context = await memeCache.getUserContext(chatId);
                if (!context) {
                    await bot.sendMessage(chatId, '❌ *Template not available*\n\nPlease search for a meme first.', { parse_mode: 'Markdown' });
                    return;
                }
                await bot.sendPhoto(chatId, context.blankTemplateUrl, {
                    caption: `🎨 *Blank Template for "${context.memeName}"*\n\n` +
                        `✨ *Create your own version:* [here](${MEME_URL}/${formatMemeNameForUrl(context.memeName)})`,
                    parse_mode: 'Markdown'
                });

            } else if (command === 'more' && action === 'templates') {
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
                                const caption = `🎭 *Page ${currentPage} - Example ${i + 1}/${relevantImages.length}*
                                ${image.alt.replace(/"/g, '').substring(0, 200)}`;
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

            } else if (command === 'reset' && action === 'pages') {
                const context = await memeCache.getUserContext(chatId);
                if (context) {
                    context.currentPage = 1;
                    await memeCache.setUserContext(chatId, context);
                    await bot.sendMessage(chatId, `🔙 *Reset to Page 1*`, { parse_mode: 'Markdown' });
                }

            } else if (command === 'new' && action === 'search') {
                await memeCache.deleteUserContext(chatId);
                await bot.sendMessage(chatId, '🔍 *Ready for a new search!*\n\nUse `/meme [name]` or `/blank [name]`', { parse_mode: 'Markdown' });
            }

        } catch (error) {
            console.error('Error handling callback query:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: "Something went wrong. Please try again.", show_alert: true });
        }
    });
};