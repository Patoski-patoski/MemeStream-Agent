// src/meme-generator/agents/memegeneratorAgent.ts

import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { Page } from 'playwright';
import { ResponseHandler } from "../types/types.js";

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

const toolFunctions: Record<string, Function> = {
    search_meme: searchMemeAndGetFirstLink,
    scrape_meme_images: scrapeMemeImagesFromPage
};

// Enhanced main function with better error handling and user feedback
export async function runMemeAgent(
    memeNameInput: string,
    responseHandler?: ResponseHandler
) {
    // Used the global browser from the main bot file (instead of creating a new one)
    let page: Page | undefined;

    try {
        // Get page from the responseHandler if available (passed from main bot)
        console.log("responseHandler\n\n", responseHandler);
        if (responseHandler && 'page' in responseHandler) {
            page = (responseHandler as any).page;
        } else {
            throw new Error("No page instance available for meme agent");
        }

        console.log(`\n🚀 Starting meme agent for: "${memeNameInput}"`);

        // Initial conversation history
        let contents: { role: string, parts: ContentPart[] }[] = [
            {
                role: "user",
                parts:
                    [{
                        text: `You are a helpful meme generator agent. Your task is to find a meme,
                         extract its URL, and scrape its associated images. Present results in a concise,
                         well-formatted summary.`
                    }]
            },
            {
                role: "user",
                parts:
                    [{
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

        if (
            resultStep1.candidates
            && resultStep1.candidates[0]
            && resultStep1.candidates[0].content) {
            
            contents.push(
                resultStep1.candidates[0].content as {
                    role: string; parts: ContentPart[]; 
                    
                });
        
        } else {
            throw new Error("Failed to get search instruction from AI model");
        }

        const functionCallStep1 = resultStep1.functionCalls?.[0];

        if (!functionCallStep1 || functionCallStep1.name !== "search_meme") {
            throw new Error(
                `Expected 'search_meme' function call, but got:
                ${functionCallStep1?.name || 'none'}`
            );
        }

        // Execute the search
        console.log(`🌐 Step 2: Executing meme search`);
        
        const memeSearchResult = await toolFunctions[functionCallStep1.name](
            page,
            functionCallStep1.args!.memeName) as MemeSearchResult;

        if (!memeSearchResult || !memeSearchResult.memePageFullUrl) {
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
                functionResponse:
                {
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

        if (
            resultStep3.candidates
            && resultStep3.candidates[0]
            && resultStep3.candidates[0].content) {
            
            contents.push(
                resultStep3.candidates[0].content as
                { role: string; parts: ContentPart[]; }
            );

        } else {
            throw new Error("Failed to get scrape instruction from AI model");
        }

        const functionCallStep3 = resultStep3.functionCalls?.[0];

        if (!functionCallStep3 || functionCallStep3.name !== "scrape_meme_images") {
            throw new Error(
                `Expected 'scrape_meme_images' function call,
                but got: ${functionCallStep3?.name || 'none'}`
            );
        }

        // --- Step 4: Execute both origin story and image scraping concurrently ---
        console.log(`📚 Step 4: Getting origin story and scraping images concurrently`);

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

            const scrapedImages = await toolFunctions.scrape_meme_images(
                page, memeSearchResult.memePageFullUrl) as MemeImageData[];
            
            console.log(`📸 Found ${scrapedImages.length} images`);

            return { images: scrapedImages };
        })();

        // Wait for both operations to complete
        const [fullOriginStory, scrapedImagesResult] = await Promise.all([
            originStreamPromise,
            scrapedImagesPromise
        ]);

        // Send origin story to user immediately when it's ready
        if (responseHandler && fullOriginStory) {
            await responseHandler.sendUpdate(fullOriginStory);
        }

        // Add scrape result to conversation
        contents.push({
            role: 'tool',
            parts: [{ functionResponse: { name: functionCallStep3.name, response: scrapedImagesResult } }]
        });

        // --- Step 5: Generate final comprehensive summary ---
        console.log(`📊 Step 5: Generating final summary`);

        contents.push({
            role: 'user',
            parts: [{
                text: `Please provide a well-formatted summary including:
                - Main page URL: ${memeSearchResult.memePageFullUrl}
                - Blank template URL: ${memeSearchResult.memeBlankImgUrl}
                - Number of scraped images: ${scrapedImagesResult?.images?.length || 0}
                
                Format this as a clear, concise summary for the user. Focus on practical information they can use.`
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

        throw error; // Re-throw so the main bot handler can also handle it
    }
}

// Export additional utility functions for the bot
export function validateMemeRequest(memeName: string): { isValid: boolean; suggestion?: string } {
    if (!memeName || memeName.trim().length === 0) {
        return { isValid: false, suggestion: "Please provide a meme name" };
    }

    if (memeName.length > 50) {
        return { isValid: false, suggestion: "Meme name is too long. Please use a shorter name." };
    }

    // Check for common misspellings or alternative formats
    const normalizedName = memeName.toLowerCase().trim();

    // Add common meme name suggestions
    const popularMemes = [
        'drake hotline bling', 'distracted boyfriend', 'this is fine', 'wojak', 'pepe',
        'expanding brain', 'Chill guy', 'woman yelling at cat',
        'two buttons', 'change my mind', 'surprised pikachu'
    ];

    return { isValid: true };
}

export function formatMemeSearchError(memeName: string, error: Error): string {
    return `❌ *Search Failed for "${memeName}"*\n\n` +
        `🔍 Error: ${error.message}\n\n` +
        `💡 *Try these tips:*\n` +
        `• Use exact meme names\n` +
        `• Check spelling\n` +
        `• Try popular memes like "Drake" or "Distracted Boyfriend"\n\n` +
        `🔄 Ready to try again when you are!`;
}