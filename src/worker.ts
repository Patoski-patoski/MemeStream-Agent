// src/worker.ts
import { Worker, Job } from 'bullmq';
import { bot } from './bot/core/bot.js';
import { memeQueue } from './bot/core/queue.js';
import { MemeJobData, ProgressTracker } from './bot/types/types.js';
import { getBrowser, closeBrowser } from './bot/core/browser.js';
import { searchMemeAndGetFirstLink } from './meme-generator/tools/meme-generator-tools.js';
import { memeCache } from './bot/core/cache.js';
import { formatMemeNameForUrl } from './bot/utils/formatters.js';
import { Page } from 'playwright';
import { runMemeAgent } from './meme-generator/agents/memegeneratorAgent.js';
import { updateProgress } from './bot/utils/utils.js';

const MEME_URL = process.env.MEME_URL;

console.log(`Worker started, waiting for jobs in queue: ${memeQueue.name}`);

const processor = async (job: Job<MemeJobData>) => {
    const { chatId, memeName, loadingMessageId, jobType, context } = job.data;
    console.log(`Processing job ${job.id} for meme "${memeName}", type: ${jobType}`);

    if (jobType === 'blank') {
        try {
            const foundMeme = await memeCache.findMemeInCache(memeName);

            if (foundMeme) {
                console.log(`✅ Found "${memeName}" in API cache as "${foundMeme.name}". Sending instantly.`);
                await bot.deleteMessage(chatId, loadingMessageId);
                const inlineKeyboard = {
                    inline_keyboard: [
                        [{ text: '🖼️ View Examples', callback_data: `view_examples_${chatId}` }, { text: '🔍 Full Meme Info', callback_data: `full_info_${chatId}` }],
                        [{ text: '🔄 Get Another Blank', callback_data: `new_blank_${chatId}` }]
                    ]
                };
                await memeCache.setUserContext(chatId, {
                    memePageUrl: `https://imgflip.com/meme/${foundMeme.id}/${formatMemeNameForUrl(foundMeme.name)}`,
                    blankTemplateUrl: foundMeme.url,
                    memeName: foundMeme.name,
                    currentPage: 1,
                    lastRequestTime: Date.now()
                });
                await bot.sendPhoto(chatId, foundMeme.url, {
                    caption: `🎨 *Blank Template: "${foundMeme.name}"*
✨ *Create your own version:* [here](${MEME_URL}/${formatMemeNameForUrl(foundMeme.name)})
💡 *Tips:* Right-click to save, use the link to add text, or use the buttons below.`,
                    parse_mode: 'Markdown',
                    reply_markup: inlineKeyboard
                });
                await memeCache.cacheBlankMeme(memeName, foundMeme.url);
                return { success: true, url: foundMeme.url };
            }

            await bot.editMessageText(`🤔 *Meme not found in quick database...*
🕵️‍♂️ Starting a deep search now. This might take a moment!`, {
                chat_id: chatId,
                message_id: loadingMessageId,
                parse_mode: 'Markdown'
            });

            const browser = getBrowser();
            if (!browser) throw new Error('Browser not initialized');

            let page: Page | undefined;
            try {
                page = await browser.newPage();
                const memeSearchResult = await searchMemeAndGetFirstLink(page, memeName);

                if (!memeSearchResult || !memeSearchResult.memeBlankImgUrl) {
                    await bot.editMessageText(`❌ *Deep search failed*
🔍 No template found for "${memeName}"
💡 *Suggestions:* Try a different name, check spelling, or use popular memes like Drake, Distracted Boyfriend, This is Fine.`, {
                        chat_id: chatId,
                        message_id: loadingMessageId,
                        parse_mode: 'Markdown'
                    });
                    return { success: false, error: 'Template not found in deep search' };
                }

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
                        [{ text: '🖼️ View Examples', callback_data: `view_examples_${chatId}` }, { text: '🔍 Full Meme Info', callback_data: `full_info_${chatId}` }],
                        [{ text: '🔄 Get Another Blank', callback_data: `new_blank_${chatId}` }]
                    ]
                };
                await bot.sendPhoto(chatId, memeSearchResult.memeBlankImgUrl, {
                    caption: `🎨 *Blank Template: "${memeName}"*
✨ *Create your own version:* [here](${MEME_URL}/${formatMemeNameForUrl(memeName)})
💡 *Tips:* Right-click to save, use the link to add text, or use the buttons below.`,
                    parse_mode: 'Markdown',
                    reply_markup: inlineKeyboard
                });
                return { success: true, url: memeSearchResult.memeBlankImgUrl };
            } finally {
                if (page) await page.close();
            }
        } catch (error) {
            console.error(`❌ Job ${job.id} failed for meme "${memeName}":`, error);
            await bot.editMessageText(`❌ *Search failed for "${memeName}"*
🔧 *What went wrong:* Meme not in database, network issues, or Imgflip API unavailable.
💡 *Try:* A different name, check spelling, or use popular memes.`, {
                chat_id: chatId,
                message_id: loadingMessageId,
                parse_mode: 'Markdown'
            });
            throw error;
        }
    } else if (jobType === 'full') {
        const browser = getBrowser();
        if (!browser) {
            await bot.sendMessage(chatId,
                '🚀 *Bot is starting up...*' +
                '⚙️ Initializing browser engine...' +
                '⏳ Please try again in a moment!',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const tracker: ProgressTracker = {
            chatId,
            messageId: loadingMessageId,
            currentStep: 1,
            totalSteps: 4,
            startTime: Date.now()
        };

        const progressInterval = setInterval(async () => {
            if (tracker.currentStep < tracker.totalSteps) {
                tracker.currentStep++;
                const progressMessages = ['🔍 *Accessing meme page...*', '📚 *Gathering origin story...*', '🖼️ *Collecting image examples...*', '✅ *Finalizing results...*'];
                await updateProgress(bot, tracker, progressMessages[tracker.currentStep - 1]);
            }
        }, 8000);

        let page: Page | undefined;
        try {
            page = await browser.newPage();
            const responseHandler = {
                page,
                async sendUpdate(text: string) {
                    if (text.includes("origin") || text.includes("Origin")) {
                        await bot.sendMessage(chatId,
                            `📚 *Meme Origin & History*
                            ${text.replace(/\*\*/g, '*').substring(0, 3500)}
                            🔍 *Still gathering more data for you...*`,
                            { parse_mode: 'Markdown' }
                        );
                    } else {
                        await bot.sendMessage(chatId, `📋 *Meme Summary* 

${text.replace(/\*\*/g, '*').replace(/Main Page URL:/g, '🌐 *Source Page:*').replace(/Blank Template URL:/g, '🎨 *Blank Template:*').replace(/Scraped Images:/g, '🖼️ *Image Collection:*').substring(0, 3500)}`, { parse_mode: 'Markdown' });
                    }
                },
                async sendImages(images: { alt: string; src: string }[], memePageUrl?: string) {
                    const relevantImages = images.filter(img => img.src.includes('http'));
                    if (relevantImages.length === 0) {
                        await bot.sendMessage(chatId,
                            '📷 *No suitable images found for preview*' +
                            'But you can use the blank template and source page links above! 🎨');
                        return;
                    }
                    await bot.sendMessage(chatId,
                        `🖼️ *Image Preview Collection* (${relevantImages.length} images)
                        📸 Here are some popular examples of this meme`,
                        { parse_mode: 'Markdown' }
                    );
                    for (let i = 0; i < relevantImages.length; i++) {
                        const image = relevantImages[i];
                        await bot.sendPhoto(chatId, image.src, {
                            caption: `🎭 *Example ${i + 1}/${relevantImages.length}*

${image.alt.replace(/"/g, '').substring(0, 200)}${image.alt.length > 200 ? '...' : ''}`, parse_mode: 'Markdown'
                        });
                        if (i < relevantImages.length - 1) await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    if (memePageUrl) {
                        const inlineKeyboard = {
                            inline_keyboard: [
                                [{ text: '🎨 Get Blank Template', callback_data: `blank_template_${chatId}` }, { text: '🔍 View More Templates', callback_data: `more_templates_${chatId}` }],
                                [{ text: '✨ Create Your Own', url: memePageUrl }],
                                [{ text: '🔄 Search Another Meme', callback_data: `new_search_${chatId}` }]
                            ]
                        };
                        const popularMemes = await memeCache.getPopularMemes();
                        const tipMessage = popularMemes.length > 0 ? `💡 *Popular searches:* ${popularMemes.join(', ')}` : `💡 *Popular searches:* Drake, Distracted Boyfriend, This is Fine`;
                        await bot.sendMessage(chatId, `🏁 *And that's a wrap on "${memeName}"!* 🏁

You're now an expert. What's next?

🎨 *Get Creative:* Grab the blank template.
🌐 *Easy Mode:* [Click here to caption it online](${memePageUrl})
🔄 *Another Round?:* Use /meme [new name]

${tipMessage}`, { parse_mode: 'Markdown', reply_markup: inlineKeyboard });
                    }
                }
            };

            const memeId = context?.memeId;
            const searchString = memeId ? `${memeId}/${memeName}` : memeName;
            const response = await runMemeAgent(searchString, responseHandler, `meme_${Date.now()}`, true);

            if (response && response.images) {
                await responseHandler.sendImages(response.images, response.memePageUrl);
            }

            if (response && response.memePageUrl && response.blankMemeUrl) {
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
            await updateProgress(bot, tracker, "✅ Full search completed successfully!", "🎉");
        } catch (error) {
            console.error("Error processing full meme request:", error);
            clearInterval(progressInterval);
            await bot.editMessageText('❌ *Oops! Something went wrong* ❌' +

                '🔧 There was an issue processing your request' +
                '💡 The meme might not exist or there could be a connectivity issue' +
                '🆘 Try with a different meme name or use `/blank` for faster results',
                {
                    chat_id: tracker.chatId,
                    message_id: tracker.messageId,
                    parse_mode: 'Markdown'
                });
            throw error;
        } finally {
            if (page) await page.close();
        }
    }
};

const worker = new Worker<MemeJobData>(memeQueue.name, processor, {
    connection: memeQueue.opts.connection,
    concurrency: 1,
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

export { worker, processor };
