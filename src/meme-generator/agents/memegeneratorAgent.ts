// src/meme-generator/agents/memegeneratorAgent.ts
import { GoogleGenAI, ApiError } from "@google/genai";
import dotenv from "dotenv";
import { Page } from 'playwright';

import {
    getOptimizedPage,
    closePage,
    getMemoryUsage
} from "../../bot/core/browser.js";

import {
    searchMemeAndGetFirstLink,
    scrapeMemeImagesFromPage
} from '../tools/meme-generator-tools.js';

import {
    ResponseHandler,
    ContentPart,
    MemeSearchResult,
    MemeImageData,
    
} from '../types/types.js';

import { RETRY_CONFIG } from "../utils/constants.js";
import {
    tools,
    isRetryableError,
    calculateDelay,
    generateFallbackMemeInfo,
    generateFallbackOriginStory
} from "../utils/utils.js";

import { memeCache } from "../../bot/core/cache.js";

dotenv.config();

const modelName = process.env.MODEL_NAME!;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const TAG_MEME = process.env.TAG_MEME!;

const toolFunctions: Record<string, Function> = {
    search_meme: searchMemeAndGetFirstLink,
    scrape_meme_images: scrapeMemeImagesFromPage
};


// Enhanced AI call with retry logic
async function callAIWithRetry(
    aiCall: () => Promise<any>,
    operation: string,
    attempt: number = 1
): Promise<any> {
    try {
        console.log(`🤖 ${operation} - Attempt ${attempt}/${RETRY_CONFIG.maxRetries + 1}`);
        return await aiCall();
    } catch (error: any) {
        console.error(`❌ ${operation} failed (attempt ${attempt}):`, error?.message || error);

        if (isRetryableError(error) && attempt <= RETRY_CONFIG.maxRetries) {
            const delay = calculateDelay(attempt);
            console.log(`⏳ Retrying ${operation} in ${delay}ms... (attempt ${attempt + 1})`);

            await new Promise(resolve => setTimeout(resolve, delay));
            return callAIWithRetry(aiCall, operation, attempt + 1);
        }

        // If not retryable or max retries reached, throw the error
        throw error;
    }
}


/**
 * Run the meme agent to search, scrape, and generate a summary of a meme with the given name.
 * @param {string} memeNameInput The name of the meme to search for.
 * @param {ResponseHandler} [responseHandler] An optional response handler to send updates to the user.
 * @param {string} [requestId] An optional request ID to identify the session.
 * @returns {Promise<{summary: string, images: MemeImageData[], memePageUrl: string, blankMemeUrl: string, originStory: string}>} A promise resolving to an object with the summary, images, meme page URL, blank meme URL, and origin story of the meme.
 */
export async function runMemeAgent(
    memeNameInput: string,
    responseHandler?: ResponseHandler,
    requestId?: string
) {
    const sessionId = requestId || `meme_${Date.now()}`;
    let page: Page | undefined;

    try {
        console.log(`\n🚀 Starting meme agent for: "${memeNameInput}"`);
        console.log('💾 Memory before start:', getMemoryUsage());

        // 🎯 STEP 1: Check cache first
        const cachedData = await memeCache.getCachedMeme(memeNameInput);

        if (cachedData && responseHandler) {
            console.log(`⚡ Serving cached data for "${memeNameInput}"`);

            // Send cached origin story
            if (cachedData.originStory) {
                await responseHandler.sendUpdate(cachedData.originStory);
            }

            // Send cached summary
            if (cachedData.summary) {
                await responseHandler.sendUpdate(cachedData.summary);
            }

            // Send cached images
            if (cachedData.images?.length > 0) {
                await responseHandler.sendImages(cachedData.images);
            } else {
                await responseHandler.sendUpdate(
                    `📷 *No images found for preview*\n\n` +
                    `🎨 But you can use the blank template link above to create your own memes!`
                );
            }

            return {
                summary: cachedData.summary || '',
                images: cachedData.images || [],
                memePageUrl: cachedData.memePageUrl,
                blankMemeUrl: cachedData.blankTemplateUrl,
                originStory: cachedData.originStory || ''
            };
        }

        // Get optimized page instance
        page = await getOptimizedPage(sessionId);
        console.log('📄 Reusing optimized page instance');

        let memeSearchResult: MemeSearchResult | null = null;
        let scrapedImages: MemeImageData[] = [];
        let originStory = "";
        let finalSummary = "";

        // --- Step 1: Direct meme search (bypass AI if possible) ---
        console.log(`🔍 Step 1: Searching for "${memeNameInput}"`);

        try {
            // Try AI-guided search first
            const contents: { role: string, parts: ContentPart[] }[] = [
                {
                    role: "user",
                    parts: [{
                        text: `You are a helpful meme generator agent. Your task is to find a meme,
                             extract its URL, and scrape its associated images. Present results in a concise,
                             well-formatted summary.`
                    }]
                },
                {
                    role: "user",
                    parts: [{
                        text: `Please find the meme named "${memeNameInput}" and show me 
                            its main URL and associated images.`
                    }]
                }
            ];

            const resultStep1 = await callAIWithRetry(
                () => ai.models.generateContent({
                    model: modelName,
                    contents,
                    config: { tools }
                }),
                "AI-guided meme search"
            );

            if (resultStep1.candidates?.[0]?.content) {
                contents.push(resultStep1.candidates[0].content as {
                    role: string; parts: ContentPart[];
                });

                const functionCallStep1 = resultStep1.functionCalls?.[0];

                if (functionCallStep1?.name === "search_meme") {
                    console.log(`🌐 Step 2: Executing AI-guided meme search`);
                    memeSearchResult = await toolFunctions[functionCallStep1.name](
                        page,
                        functionCallStep1.args!.memeName
                    ) as MemeSearchResult;
                }
            }
        } catch (aiError: any) {
            console.log(`⚠️ AI-guided search failed, falling back to direct search...`);

            // Fallback: Direct search without AI
            console.log(`🔍 Step 2: Direct meme search (AI fallback)`);
            try {
                memeSearchResult = await searchMemeAndGetFirstLink(page, memeNameInput) as MemeSearchResult;
                console.log(`✅ Direct search successful`);
            } catch (directSearchError) {
                console.error(`❌ Direct search also failed:`, directSearchError);
                throw directSearchError;
            }
        }

        // Check if we found the meme
        if (!memeSearchResult?.memePageFullUrl) {
            if (responseHandler) {
                await responseHandler.sendUpdate(
                    `❌ *Could not find meme: "${memeNameInput}"*\n\n` +
                    `🔍 Please try:\n` +
                    `• Check spelling\n` +
                    `• Use popular meme names (Drake, Distracted Boyfriend, etc.)\n` +
                    `• Try alternative names\n\n` +
                    `💡 *Tip:* Search for well-known internet memes`
                );
            }
            return null;
        }

        // --- Step 3: Get origin story and scrape images concurrently ---
        console.log(`📚 Step 3: Getting origin story and scraping images concurrently`);
        console.log('💾 Memory before concurrent operations:', getMemoryUsage());

        // Origin story with fallback
        const originStoryPromise = (async () => {
            try {
                const originContents: { role: string; parts: ContentPart[] }[] = [
                    {
                        role: "user",
                        parts: [{
                            text: `You are a meme historian. 
                            Provide an engaging, informative origin story for memes. 
                            Include: when it started, how it became popular, typical usage, and cultural impact.
                            Keep it conversational but informative, around 100-250 words.
                            Use emojis sparingly for readability.`
                        }]
                    },
                    {
                        role: "user",
                        parts: [{ text: `Tell me the fascinating origin story of the "${memeNameInput}" meme.` }]
                    }
                ];

                const streamResult = await callAIWithRetry(
                    () => ai.models.generateContentStream({
                        model: modelName,
                        contents: originContents,
                        config: {
                            temperature: 0.8,
                            topP: 0.95,
                            topK: 40,
                        },
                    }),
                    "Origin story generation"
                );

                console.log("\n📖 Streaming meme origin story...");
                let streamedText = "";
                for await (const chunk of streamResult) {
                    const textChunk = chunk.text;
                    if (textChunk) {
                        streamedText += textChunk;
                    }
                }
                console.log("✅ Origin story completed");
                return streamedText;

            } catch (originError: any) {
                console.log(`⚠️ AI origin story failed, using fallback...`);
                return generateFallbackOriginStory(memeNameInput);
            }
        })();

        // Image scraping (this doesn't depend on AI)
        const scrapedImagesPromise = (async () => {
            try {
                console.log(`🖼️ Scraping images from: ${memeSearchResult!.memePageFullUrl}`);
                if (memeSearchResult!.memePageFullUrl === TAG_MEME) {
                    throw new Error(`Unable to find the "${memeNameInput}" meme`);
                }

                const scrapedImages = await toolFunctions.scrape_meme_images(
                    page, memeSearchResult!.memePageFullUrl
                ) as MemeImageData[];

                console.log(`📸 Found ${scrapedImages.length} images`);
                return scrapedImages;
            } catch (scrapeError) {
                console.error(`❌ Image scraping failed:`, scrapeError);
                return [] as MemeImageData[];
            }
        })();

        // Wait for both operations
        const [fullOriginStory, scrapedImagesResult] = await Promise.all([
            originStoryPromise,
            scrapedImagesPromise
        ]);

        originStory = fullOriginStory;
        scrapedImages = scrapedImagesResult;

        console.log('💾 Memory after operations:', getMemoryUsage());

        // Send origin story immediately
        if (responseHandler && originStory) {
            await responseHandler.sendUpdate(originStory);
        }

        // --- Step 4: Generate final summary with fallback ---
        console.log(`📊 Step 4: Generating final summary`);

        try {
            const summaryContents: { role: string; parts: ContentPart[] }[] = [
                {
                    role: 'user',
                    parts: [{
                        text: `Create a Telegram-compatible Markdown summary with the following information:

Format the URLs with proper Markdown escaping and add emojis for visual hierarchy:

🌐 *Source Page:* ${memeSearchResult.memePageFullUrl}

🎨 *Blank Template:* ${memeSearchResult.memeBlankImgUrl}

📸 *Available Examples:* ${scrapedImages?.length || 0} images

Requirements:
- Use single asterisks for *bold* text
- Add a blank line between each item
- Keep URLs unformatted (no Markdown)
- Use simple formatting to avoid Telegram parsing errors
- Keep the summary concise and user-friendly

Example format:
🌐 *Source:* http://example.com
(blank line)
🎨 *Template:* http://example.com/template
(blank line)
📸 *Images Found:* 5 examples`
                    }]
                }
            ];

            const finalResult = await callAIWithRetry(
                () => ai.models.generateContent({
                    model: modelName,
                    contents: summaryContents,
                    config: { tools }
                }),
                "Final summary generation"
            );

            finalSummary = finalResult.text || generateFallbackMemeInfo(memeNameInput, memeSearchResult, scrapedImages);
            console.log("✅ AI summary generated successfully");

        } catch (summaryError: any) {
            console.log(`⚠️ AI summary failed, using fallback...`);
            finalSummary = generateFallbackMemeInfo(memeNameInput, memeSearchResult, scrapedImages);
        }

        // --- Step 5: Send results through response handler ---
        if (responseHandler) {
            // Send the final summary
            if (finalSummary) {
                await responseHandler.sendUpdate(finalSummary);
            }

            // Send the scraped images if available
            if (scrapedImages?.length > 0) {
                await responseHandler.sendImages(scrapedImages);
            } else {
                await responseHandler.sendUpdate(
                    `📷 *No images found for preview*\n\n` +
                    `🎨 But you can still use the blank template link above to create your own memes!`
                );
            }
        }
        // After successful processing, cache the results
        if (memeSearchResult?.memePageFullUrl) {
            await memeCache.cacheMeme(memeNameInput, {
                memePageUrl: memeSearchResult.memePageFullUrl,
                blankTemplateUrl: memeSearchResult.memeBlankImgUrl as string,
                memeName: memeNameInput,
                images: scrapedImages,
                originStory: originStory,
                summary: finalSummary,
                lastRequestTime: Date.now(),
                currentPage: 1,
            });

            console.log(`💾 Cached results for "${memeNameInput}"`);
        }

        return {
            summary: finalSummary,
            images: scrapedImages || [],
            memePageUrl: memeSearchResult.memePageFullUrl,
            blankMemeUrl: memeSearchResult.memeBlankImgUrl,
            originStory: originStory
        };

    } catch (error) {
        console.error("❌ Error in meme agent execution:", error);
        console.log('💾 Memory during error:', getMemoryUsage());

        const apiError = error as ApiError;

        if (responseHandler) {
            const isAIOverload = apiError.status === 503 || apiError?.message?.includes('overloaded');

            await responseHandler.sendUpdate(
                isAIOverload
                    ? `🤖 *AI Services Temporarily Busy*\n\n` +
                    `⚡ The AI model is currently overloaded, but we're still working to get your meme data!\n\n` +
                    `🔄 *What's happening:*\n` +
                    `• Searching for "${memeNameInput}" using direct methods\n` +
                    `• Gathering available templates and images\n` +
                    `• Skipping AI analysis to avoid delays\n\n` +
                    `💡 *Please wait a moment...* We'll get you the essential meme info!`
                    : `❌ *Processing Error*\n\n` +
                    `🔧 Something went wrong while processing "${memeNameInput}"\n\n` +
                    `💡 *Suggestions:*\n` +
                    `• Try a different meme name\n` +
                    `• Check if the meme name is spelled correctly\n` +
                    `• Use well-known meme names\n\n` +
                    `🔄 Feel free to try again!`
            );
        }

        // For AI overload, try one more time with direct search
        if (apiError?.status === 503 && page) {
            try {
                console.log(`🚨 AI overload detected, attempting emergency direct search...`);

                const emergencyResult = await searchMemeAndGetFirstLink(page, memeNameInput) as MemeSearchResult;

                if (emergencyResult?.memePageFullUrl) {
                    const emergencyImages = await scrapeMemeImagesFromPage(page, emergencyResult.memePageFullUrl) as MemeImageData[];
                    const fallbackSummary = generateFallbackMemeInfo(memeNameInput, emergencyResult, emergencyImages);
                    const fallbackOrigin = generateFallbackOriginStory(memeNameInput);

                    if (responseHandler) {
                        await responseHandler.sendUpdate(fallbackOrigin);
                        await responseHandler.sendUpdate(fallbackSummary);

                        if (emergencyImages?.length > 0) {
                            await responseHandler.sendImages(emergencyImages);
                        }
                    }

                    return {
                        summary: fallbackSummary,
                        images: emergencyImages || [],
                        memePageUrl: emergencyResult.memePageFullUrl,
                        blankMemeUrl: emergencyResult.memeBlankImgUrl,
                        originStory: fallbackOrigin
                    };
                }
            } catch (emergencyError) {
                console.error(`❌ Emergency search also failed:`, emergencyError);
            }
        }

        throw error;
    } finally {
        // Clean up: close the page for this session to free memory
        if (sessionId) {
            await closePage(sessionId);
            console.log(`🧹 Cleaned up session: ${sessionId}`);
        }

        console.log('💾 Memory after cleanup:', getMemoryUsage());

        // Force garbage collection if available
        if (global.gc) {
            global.gc();
            console.log('🗑️ Garbage collection triggered');
        }
    }
}