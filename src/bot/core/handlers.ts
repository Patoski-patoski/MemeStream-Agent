// src/bot/core/handlers.ts
import TelegramBot from 'node-telegram-bot-api';
import { Page } from 'playwright';
import { getBrowser } from './browser.js';
import { runMemeAgent } from '../../meme-generator/agents/memegeneratorAgent.js';
import { searchMemeAndGetFirstLink } from '../../meme-generator/tools/meme-generator-tools.js';
import { ProgressTracker } from '../types/types.js';
import {
    progressMessages,
    updateProgress,
    constructPageUrl
} from '../utils/utils.js';
import { formatMemeNameForUrl, formatMemeNameForDisplay } from '../utils/formatters.js';
import { memeCache } from './cache.js';

const MEME_URL = process.env.MEME_URL;

// Helper function to trigger full meme search
const triggerFullMemeSearch = async (bot: TelegramBot, chatId: number, memeName: string) => {
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

    const initialMessage = await bot.sendMessage(chatId, progressMessages[0]);

    const tracker: ProgressTracker = {
        chatId,
        messageId: initialMessage.message_id,
        currentStep: 1,
        totalSteps: 6,
        startTime: Date.now()
    };

    const progressInterval = setInterval(async () => {
        if (tracker.currentStep < tracker.totalSteps) {
            tracker.currentStep++;
            await updateProgress(bot, tracker, progressMessages[tracker.currentStep - 1]);
        }
    }, 10000);

    const patienceTimeout = setTimeout(async () => {
        try {
            const patientMessage = await bot.sendMessage(chatId,
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

            // Schedule the message to be deleted after 45 seconds
            setTimeout(async () => {
                try {
                    if (patientMessage) {
                        await bot.deleteMessage(chatId, patientMessage.message_id);                        
                    }
                } catch (deleteError) {
                    if (deleteError.response?.body?.description !== 'Bad Request: message to delete not found') {
                        console.error('Error deleting patience message:', deleteError);
                    }
                }
            }, 45000); 

        } catch (error) {
            console.error('Error sending patience message:', error);
        }
    }, 10000);


    let page: Page | undefined;
    try {
        page = await browser.newPage();
        console.log(`Opened new page for full info request from chat ID: ${chatId}`);

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

        const response = await runMemeAgent(memeName, responseHandler);

        if (response && response.memePageUrl && response.blankMemeUrl) {
            await memeCache.setUserContext(chatId, {
                memePageUrl: response.memePageUrl,
                blankTemplateUrl: response.blankMemeUrl,
                memeName: memeName,
                currentPage: 1,
                lastRequestTime: Date.now()
            });
        }

        clearTimeout(patienceTimeout);
        clearInterval(progressInterval);

        tracker.currentStep = tracker.totalSteps;
        await updateProgress(bot, tracker, "✅ Completed successfully!", "🎉");

    } catch (error) {
        console.error("Error processing full meme request:", error);

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
        return;
    } finally {
        if (page) {
            await page.close();
            console.log(`Closed page for full info request from chat ID: ${chatId}`);
        }
    }
};



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


export const handleBlankMemeCommand = (bot: TelegramBot) => {
    bot.onText(/^\/blank( (.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        let memeName = match?.[1];

        if (!memeName) {
            bot.sendMessage(chatId,
                '❌ *Please provide a meme name*\n\n' +
                '📝 Example: `/blank Distracted Boyfriend`\n' +
                '💡 Try popular memes like: Chill guy, Epic handshake, Drake hotline bling, etc.',
                { parse_mode: 'Markdown' }
            );
            return;
        }
        memeName = formatMemeNameForDisplay(memeName);
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

        const cachedUrl = await memeCache.getBlankMeme(memeName);

        if (cachedUrl) {
            await bot.sendPhoto(chatId, cachedUrl, {
                caption: `🎨 *Blank Template: "${memeName}"*\n\n` +
                    `✨ *Create your own version:*\n` +
                    `🔗 ${MEME_URL}/${formatMemeNameForUrl(memeName)}\n\n` +
                    `💡 *Tips:*\n` +
                    `• Right-click the image to save it\n` +
                    `• Use the link above to add custom text` + 
                 `• Click buttons below for more options`,
                parse_mode: 'Markdown',
                reply_markup: inlineKeyboard
            });
            return;
        }

        const browser = getBrowser();
        if (!browser) {
            bot.sendMessage(chatId,
                '🚀 *Bot is starting up...*\n\n' +
                '⚙️ Initializing browser engine...\n' +
                '⏳ Please try again in a moment!',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const loadingMsg = await bot.sendMessage(chatId,
            '🔍 *Searching for blank template...*\n\n' +
            `📋 Looking up "${memeName}"...`,
            { parse_mode: 'Markdown' }
        );

        let page: Page | undefined;
        try {
            page = await browser.newPage();
            const memeSearchResult = await searchMemeAndGetFirstLink(page, memeName);

            if (!memeSearchResult || !memeSearchResult.memeBlankImgUrl) {
                await bot.editMessageText(
                    '❌ *Blank template not found*\n\n' +
                    `🔍 No blank template found for "${memeName}"\n` +
                    '💡 Try a different meme name or check spelling',
                    {
                        chat_id: chatId,
                        message_id: loadingMsg.message_id,
                        parse_mode: 'Markdown'
                    }
                );
                return;
            }

            await memeCache.cacheBlankMeme(memeName, memeSearchResult.memeBlankImgUrl);

            // Store context for inline keyboard actions
            await memeCache.setUserContext(chatId, {
                memePageUrl: memeSearchResult.memePageFullUrl,
                blankTemplateUrl: memeSearchResult.memeBlankImgUrl,
                memeName: memeName,
                currentPage: 1,
                lastRequestTime: Date.now()
            });

            // Delete the loading message
            await bot.deleteMessage(chatId, loadingMsg.message_id);


            // Send the blank template with rich caption
            await bot.sendPhoto(chatId, memeSearchResult.memeBlankImgUrl, {
                caption: `🎨 *Blank Template: "${memeName}"*\n\n` +
                    `✨ *Create your own version:*
` +
                    `🔗 ${MEME_URL}/${formatMemeNameForUrl(memeName)}

` +
                    `💡 *Tips:*
` +
                    `• Right-click the image to save it
` +
                    `• Use the link above to add custom text
` +
                    `• Click buttons below for more options`,
                parse_mode: 'Markdown',
                reply_markup: inlineKeyboard
            });

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
        } finally {
            if (page) {
                await page.close();
                console.log(`Closed page for blank request from chat ID: ${chatId}`);
            }
        }
    });
};

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

        memeName = formatMemeNameForDisplay(memeName);
        await triggerFullMemeSearch(bot, chatId, memeName);
    });
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
                await triggerFullMemeSearch(bot, chatId, context.memeName);

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
