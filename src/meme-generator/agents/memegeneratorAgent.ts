// src/meme-generator/agents/memegeneratorAgent.ts
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { Page } from 'playwright';
import { ResponseHandler } from "../types/types.js";
import { getOptimizedPage, closePage, getMemoryUsage } from "../../bot/core/browser.js";

import {
    searchMemeAndGetFirstLink,
    scrapeMemeImagesFromPage
} from '../tools/meme-generator-tools.js';

import {
    ContentPart,
    MemeSearchResult,
    MemeImageData
} from '../types/types.js';

import { tools } from "../utils/utils.js";

dotenv.config();

const modelName = process.env.MODEL_NAME!;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const TAG_MEME = process.env.TAG_MEME!;

const toolFunctions: Record<string, Function> = {
    search_meme: searchMemeAndGetFirstLink,
    scrape_meme_images: scrapeMemeImagesFromPage
};

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

        // Get optimized page instance
        page = await getOptimizedPage(sessionId);
        console.log('📄 Reusing optimized page instance');

        // Initial conversation history
        let contents: { role: string, parts: ContentPart[] }[] = [
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

        // --- Step 1: Search for the meme ---
        console.log(`🔍 Step 1: Searching for "${memeNameInput}"`);
        const resultStep1 = await ai.models.generateContent({
            model: modelName,
            contents,
            config: { tools }
        });

        if (!resultStep1.candidates?.[0]?.content) {
            throw new Error("Failed to get search instruction from AI model");
        }

        contents.push(resultStep1.candidates[0].content as {
            role: string; parts: ContentPart[];
        });

        const functionCallStep1 = resultStep1.functionCalls?.[0];

        if (!functionCallStep1 || functionCallStep1.name !== "search_meme") {
            throw new Error(
                `Expected 'search_meme' function call, but got: ${functionCallStep1?.name || 'none'}`
            );
        }

        // Execute the search
        console.log(`🌐 Step 2: Executing meme search`);
        console.log('💾 Memory before search:', getMemoryUsage());

        const memeSearchResult = await toolFunctions[functionCallStep1.name](
            page,
            functionCallStep1.args!.memeName
        ) as MemeSearchResult;

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

        // Add search result to conversation
        contents.push({
            role: 'tool',
            parts: [{
                functionResponse: {
                    name: functionCallStep1.name,
                    response: memeSearchResult
                }
            }]
        });

        // --- Step 3: Get scrape instruction ---
        console.log(`📋 Step 3: Getting image scrape instruction`);
        const resultStep3 = await ai.models.generateContent({
            model: modelName,
            contents,
            config: { tools }
        });

        if (!resultStep3.candidates?.[0]?.content) {
            throw new Error("Failed to get scrape instruction from AI model");
        }

        contents.push(resultStep3.candidates[0].content as {
            role: string; parts: ContentPart[];
        });

        const functionCallStep3 = resultStep3.functionCalls?.[0];

        if (!functionCallStep3 || functionCallStep3.name !== "scrape_meme_images") {
            throw new Error(
                `Expected 'scrape_meme_images' function call, but got: ${functionCallStep3?.name || 'none'}`
            );
        }

        // --- Step 4: Execute operations concurrently ---
        console.log(`📚 Step 4: Getting origin story and scraping images concurrently`);
        console.log('💾 Memory before concurrent operations:', getMemoryUsage());

        // Enhanced origin story prompt
        const originStreamPromise = (async () => {
            const originContents: { role: string; parts: ContentPart[] }[] = [
                {
                    role: "user",
                    parts: [{
                        text: `You are a meme historian. 
                        Provide an engaging, informative origin story for memes. 
                        Include: when it started, how it became popular, typical usage, and cultural impact.
                        Keep it conversational but informative, around 150-300 words.
                        Use emojis sparingly for readability.`
                    }]
                },
                {
                    role: "user",
                    parts: [{ text: `Tell me the fascinating origin story of the "${memeNameInput}" meme.` }]
                }
            ];

            const streamResult = await ai.models.generateContentStream({
                model: modelName,
                contents: originContents,
            });

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
        })();

        // Execute image scraping
        const scrapedImagesPromise = (async () => {
            console.log(`🖼️ Scraping images from: ${memeSearchResult.memePageFullUrl}`);
            if (memeSearchResult.memePageFullUrl === TAG_MEME) {
                throw new Error(`Unable to find the "${memeNameInput}" meme`);
            }

            const scrapedImages = await toolFunctions.scrape_meme_images(
                page, memeSearchResult.memePageFullUrl
            ) as MemeImageData[];

            console.log(`📸 Found ${scrapedImages.length} images`);
            return { images: scrapedImages };
        })();

        // Wait for both operations to complete
        const [fullOriginStory, scrapedImagesResult] = await Promise.all([
            originStreamPromise,
            scrapedImagesPromise
        ]);

        console.log('💾 Memory after operations:', getMemoryUsage());

        // Send origin story to user immediately when it's ready
        if (responseHandler && fullOriginStory) {
            await responseHandler.sendUpdate(fullOriginStory);
        }

        // Add scrape result to conversation
        contents.push({
            role: 'tool',
            parts: [{
                functionResponse: {
                    name: functionCallStep3.name,
                    response: scrapedImagesResult
                }
            }]
        });

        // --- Step 5: Generate final comprehensive summary ---
        console.log(`📊 Step 5: Generating final summary`);

        contents.push({
            role: 'user',
            parts: [{
                text: `Create a Telegram-compatible Markdown summary with the following information:

Format the URLs with proper Markdown escaping and add emojis for visual hierarchy:

🌐 *Source Page:* ${memeSearchResult.memePageFullUrl}

🎨 *Blank Template:* ${memeSearchResult.memeBlankImgUrl}

📸 *Available Examples:* ${scrapedImagesResult?.images?.length || 0} images

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
        });

        const finalResult = await ai.models.generateContent({
            model: modelName,
            contents,
            config: { tools }
        });

        console.log("✅ Final summary generated");

        // Send results through response handler
        if (responseHandler) {
            // Send the final summary
            if (finalResult.text) {
                await responseHandler.sendUpdate(finalResult.text as string);
            }

            // Send the scraped images if available
            if (scrapedImagesResult?.images?.length > 0) {
                await responseHandler.sendImages(scrapedImagesResult.images);
            } else {
                await responseHandler.sendUpdate(
                    `📷 *No images found for preview*\n\n` +
                    `🎨 But you can still use the blank template link above to create your own memes!`
                );
            }
        }

        return {
            summary: finalResult.text,
            images: scrapedImagesResult?.images || [],
            memePageUrl: memeSearchResult.memePageFullUrl,
            blankMemeUrl: memeSearchResult.memeBlankImgUrl,
            originStory: fullOriginStory
        };

    } catch (error) {
        console.error("❌ Error in meme agent execution:", error);
        console.log('💾 Memory during error:', getMemoryUsage());

        if (responseHandler) {
            await responseHandler.sendUpdate(
                `❌ *Processing Error*\n\n` +
                `🔧 Something went wrong while processing "${memeNameInput}"\n\n` +
                `💡 *Suggestions:*\n` +
                `• Try a different meme name\n` +
                `• Check if the meme name is spelled correctly\n` +
                `• Use well-known meme names\n\n` +
                `🔄 Feel free to try again!`
            );
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