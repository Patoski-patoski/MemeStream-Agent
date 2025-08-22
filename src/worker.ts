// src/worker.ts
import { Worker, Job } from 'bullmq';
import { bot } from './bot/core/bot.js';
import { memeQueue } from './bot/core/queue.js';
import { MemeJobData } from './bot/types/types.js';
import { getBrowser, closeBrowser } from './bot/core/browser.js';
import { searchMemeAndGetFirstLink } from './meme-generator/tools/meme-generator-tools.js';
import { memeCache } from './bot/core/cache.js';
import { formatMemeNameForUrl } from './bot/utils/formatters.js';
import { Page } from 'playwright';

const MEME_URL = process.env.MEME_URL;

console.log(`Worker started, waiting for jobs in queue: ${memeQueue.name}`);

const processor = async (job: Job<MemeJobData>) => {
    const { chatId, memeName, loadingMessageId } = job.data;
    console.log(`Processing job ${job.id} for meme "${memeName}"`);

    try {
        // Step 1: Try to find the meme in the cached API data (FASTEST path)
        console.log(`🚀 Step 1: Checking Imgflip API cache for "${memeName}"`);

        const foundMeme = await memeCache.findMemeInCache(memeName);

        if (foundMeme) {
            console.log(`✅ Found "${memeName}" in API cache as "${foundMeme.name}". Sending instantly.`);

            try {
                await bot.deleteMessage(chatId, loadingMessageId);

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

                // Store context using the actual meme name from API for consistency
                await memeCache.setUserContext(chatId, {
                    memePageUrl: `https://imgflip.com/meme/${foundMeme.id}/${formatMemeNameForUrl(foundMeme.name)}`,
                    blankTemplateUrl: foundMeme.url,
                    memeName: foundMeme.name, // Use the official name from API
                    currentPage: 1,
                    lastRequestTime: Date.now()
                });

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

                // Cache the blank meme with both the searched name and official name for future hits
                await memeCache.cacheBlankMeme(memeName, foundMeme.url);
                if (memeName.toLowerCase() !== foundMeme.name.toLowerCase()) {
                    await memeCache.cacheBlankMeme(foundMeme.name, foundMeme.url);
                }

                return { success: true, url: foundMeme.url };

            } catch (error) {
                console.error('Error sending API-found meme:', error);
                throw error;
            }
        }

        // Step 2: If not in API data, fall back to scraping (slower path)
        console.log(`⚠️ "${memeName}" not found in API cache`);
        console.log(`🕵️‍♂️ Step 2: Falling back to web scraping method`);

        await bot.editMessageText(
            `🤔 *Meme not found in quick database...*\n\n` +
            `🕵️‍♂️ Starting a deep search now. This might take a moment!`,
            {
                chat_id: chatId,
                message_id: loadingMessageId,
                parse_mode: 'Markdown'
            }
        );

        const browser = getBrowser();
        if (!browser) {
            console.error('Browser not initialized in worker.');
            throw new Error('Browser not initialized');
        }

        let page: Page | undefined;
        try {
            page = await browser.newPage();
            console.log(`🔍 Scraping for "${memeName}" using web search`);

            const memeSearchResult = await searchMemeAndGetFirstLink(page, memeName);

            if (!memeSearchResult || !memeSearchResult.memeBlankImgUrl) {
                await bot.editMessageText(
                    `❌ *Deep search failed*\n\n` +
                    `🔍 No template found for "${memeName}"\n\n` +
                    `💡 *Suggestions:*\n` +
                    `• Try a different meme name\n` +
                    `• Check spelling\n` +
                    `• Use popular meme names\n\n` +
                    `🎭 *Popular searches:* Drake, Distracted Boyfriend, This is Fine, Expanding Brain`,
                    {
                        chat_id: chatId,
                        message_id: loadingMessageId,
                        parse_mode: 'Markdown'
                    }
                );
                return { success: false, error: 'Template not found in deep search' };
            }

            // Cache the successful result for future API-style quick access
            await memeCache.cacheBlankMeme(memeName, memeSearchResult.memeBlankImgUrl);

            await memeCache.setUserContext(chatId, {
                memePageUrl: memeSearchResult.memePageFullUrl,
                blankTemplateUrl: memeSearchResult.memeBlankImgUrl,
                memeName: memeName,
                currentPage: 1,
                lastRequestTime: Date.now()
            });

            await bot.deleteMessage(chatId, loadingMessageId);

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

            await bot.sendPhoto(chatId, memeSearchResult.memeBlankImgUrl, {
                caption: `🎨 *Blank Template: "${memeName}"*\n\n` +
                    `✨ *Create your own version:*\n` +
                    `🔗 ${MEME_URL}/${formatMemeNameForUrl(memeName)}\n\n` +
                    `💡 *Tips:*\n` +
                    `• Right-click the image to save it\n` +
                    `• Use the link above to add custom text\n` +
                    `• Click buttons below for more options`,
                parse_mode: 'Markdown',
                reply_markup: inlineKeyboard
            });

            console.log(`✅ Job ${job.id} (via scraping) completed successfully for meme "${memeName}"`);
            return { success: true, url: memeSearchResult.memeBlankImgUrl };

        } catch (scrapingError) {
            console.error(`❌ Job ${job.id} (via scraping) failed for meme "${memeName}":`, scrapingError);
            try {
                await bot.editMessageText(
                    `❌ *An error occurred during the deep search*\n\n` +
                    `🔧 Please try again later or try a different meme name.`,
                    {
                        chat_id: chatId,
                        message_id: loadingMessageId,
                        parse_mode: 'Markdown'
                    }
                );
            } catch (editError) {
                console.error('Failed to send error message to user:', editError);
            }
            throw scrapingError; // Re-throw error to let BullMQ handle retries
        } finally {
            if (page) {
                await page.close();
            }
        }

    } catch (error) {
        console.error(`❌ Job ${job.id} failed for meme "${memeName}":`, error);

        // Final fallback - try to send a helpful error message
        try {
            await bot.editMessageText(
                `❌ *Search failed for "${memeName}"*\n\n` +
                `🔧 *What went wrong:*\n` +
                `• Meme not in our database\n` +
                `• Network connectivity issues\n` +
                `• ImgFlip API temporarily unavailable\n\n` +
                `💡 *Try:*\n` +
                `• Different meme name\n` +
                `• Check spelling\n` +
                `• Popular memes: Drake, Distracted Boyfriend, This is Fine`,
                {
                    chat_id: chatId,
                    message_id: loadingMessageId,
                    parse_mode: 'Markdown'
                }
            );
        } catch (finalError) {
            console.error('Failed to send final error message:', finalError);
        }

        throw error; // Re-throw for BullMQ retry logic
    }
};

const worker = new Worker<MemeJobData>(memeQueue.name, processor, {
    connection: memeQueue.opts.connection,
    concurrency: 1, // Only process one job at a time to avoid overwhelming the browser
});

worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed with error: ${err.message}`);
});

worker.on('error', (err) => {
    console.error('❌ Worker error:', err);
});

console.log(`✅ Worker is listening for jobs on queue: ${memeQueue.name}`);

async function gracefulShutdown() {
    console.log('Shutting down worker...');
    await worker.close();
    await closeBrowser();
    await memeCache.disconnect();
    process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);