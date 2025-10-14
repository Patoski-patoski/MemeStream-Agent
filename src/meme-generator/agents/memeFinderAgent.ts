// src/meme-generator/agents/memeFinderAgent.ts - Updated version

import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { ImgflipMeme } from "../../bot/types/types.js";
import { memeCache } from "../../bot/core/cache.js";
import { RETRY_CONFIG } from "../utils/constants.js";
import {
    isRetryableError,
    calculateDelay
} from "../utils/utils.js";


if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

const modelName = process.env.MODEL_NAME!;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Enhanced AI call with retry logic
 */
async function callAIWithRetry<T>(
    aiCall: () => Promise<T>,
    operation: string,
    attempt: number = 1
): Promise<T> {
    try {
        console.log(`🤖 ${operation} - Attempt ${attempt}/${RETRY_CONFIG.maxRetries + 1}`);
        return await aiCall();
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ ${operation} failed (attempt ${attempt}):`, errorMessage);

        if (isRetryableError(error as Error) && attempt <= RETRY_CONFIG.maxRetries) {
            const delay = calculateDelay(attempt);
            console.log(`⏳ Retrying ${operation} in ${delay}ms... (attempt ${attempt + 1})`);

            await new Promise(resolve => setTimeout(resolve, delay));
            return callAIWithRetry(aiCall, operation, attempt + 1);
        }

        throw error;
    }
}

/**
 * Extract keywords from a meme description using AI
 */
async function extractMemeKeywords(description: string): Promise<string[]> {
    const prompt = `You are a meme expert. Extract 3-5 key search terms from this meme description.
Return ONLY the keywords separated by commas, Emphasis on Noun, verbs and adjectives.  no explanation.

Description: "${description}"

Examples:
Input: "That meme where spiderman points at each other"
Output: spiderman, pointing, duplicate, spiderman pointing

Input: "Guy sweating choosing between two buttons"
Output: sweating, button, choice, decision, two buttons

Input: "Drake approving and disapproving"
Output: drake, hotline bling, approval, disapproval

Now extract keywords for the description above:`;

    try {
        const result = await callAIWithRetry(
            () => ai.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: { temperature: 0.3 }
            }),
            "Keyword extraction"
        );

        const keywords = (result.text as string)
            .split(',')
            .map(k => k.trim().toLowerCase())
            .filter(k => k.length > 0);

        console.log(`🔑 Extracted keywords: ${keywords.join(', ')}`);
        return keywords;

    } catch (error) {
        console.error('AI keyword extraction failed:', error);
        // Fallback: use the description as-is
        return description.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    }
}

/**
 * Finds blank meme templates based on a user's description.
 * Uses AI to extract keywords, then performs fuzzy search.
 * 
 * @param {number} chatId - The chat ID (for logging purposes)
 * @param {string} memeDescription - The user's description of the meme
 * @returns {Promise<ImgflipMeme[]>} Array of matching memes
 */
export async function findMemeByDescription(
    chatId: number,
    memeDescription: string
): Promise<ImgflipMeme[]> {

    console.log(`🔍 Starting meme search for chat ${chatId}`);
    console.log(`📝 Description: "${memeDescription}"`);

    try {
        const allResults: ImgflipMeme[] = [];
        const seenIds = new Set<string>();

        console.log('⚡ Attempting direct search with memeCache...');
        const directMeme = await memeCache.getMemesFromCacheOrApi();
        const memeNames = directMeme
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(m => m.name.toLowerCase());

        // Compare the memeDescription to each meme name using a simple similarity metric
        for (const memeName of memeNames) {
            if (memeName.includes(memeDescription.toLowerCase()) || memeDescription.toLowerCase().includes(memeName)) {
                const foundMeme = directMeme.find(m => m.name.toLowerCase() == memeName);
                if (foundMeme && !seenIds.has(foundMeme.id)) {
                    seenIds.add(foundMeme.id);
                    allResults.push(foundMeme);
                }
            }
            if (allResults.length >= 10) break; // Limit results
        }


        // Step 2: Use AI to extract keywords if direct search didn't yield enough results
        let keywords: string[] = [];
        if (allResults.length === 0) {
            console.log('🤖 Using AI to extract keywords...');
            keywords = await extractMemeKeywords(memeDescription);
        }

        // Step 3: Search with each keyword using memeCache and combine results
        if (keywords.length > 0) {
            console.log(`🔎 Searching with ${keywords.length} keywords using memeCache...`);
            for (const keyword of keywords) {
                const keywordMeme = await memeCache.findMemeInCache(keyword);
                if (keywordMeme && !seenIds.has(keywordMeme.id)) {
                    seenIds.add(keywordMeme.id);
                    allResults.push(keywordMeme);
                }
                // Don't overwhelm with too many results
                if (allResults.length >= 5) break;
            }
        }

        // Step 4: If still no results, try searching with individual words from the description
        if (allResults.length === 0) {
            console.log('🤷 No results yet, trying individual words from description...');
            const descriptionWords = memeDescription.toLowerCase().split(/\s+/).filter(word => word.length > 2);
            for (const word of descriptionWords) {
                const wordMeme = await memeCache.findMemeInCache(word);
                if (wordMeme && !seenIds.has(wordMeme.id)) {
                    seenIds.add(wordMeme.id);
                    allResults.push(wordMeme);
                }
                if (allResults.length >= 10) break;
            }
        }

        // Step 5: Sort by relevance (popularity as tiebreaker) and limit
        const sortedResults = allResults
            .sort((a, b) => (b.captions || 0) - (a.captions || 0))
            .slice(0, 5);

        console.log(`✅ Found ${sortedResults.length} total matches`);
        return sortedResults;

    } catch (error) {
        console.error('❌ Error in findMemeByDescription:', error);
        return [];
    }
}