// src/meme-generator/utils/utils.ts

import { Type } from "@google/genai";
import { Page } from 'playwright';

import {
    MemeSearchResult,
    MemeImageData,
    
} from '../types/types.js';

import { RETRY_CONFIG } from "./constants.js";


/**
 * Format a meme alt text string from a search result into a clean string to use for display.
 * Split the text at the first '|' and use the first part as the title.
 * Split the rest at the first ';' or ',' or '|' and use the first part as the subtitle.
 * Join the title and subtitle with a hyphen.
 * @param text The input string to format.
 * @returns The formatted string.
 */
export function formatMemeAltText(text: string): string {
    // Split at first '|'
    const [title, rest] = text.split('|').map(s => s.trim());
    if (!rest) return title;

    // Split rest at first ';' or ',' or '|'
    const subtitle = rest.split(/[;|,]/)[0].trim();
    return `${title}-${subtitle}`;
}


/**
 * Given a potentially relative href, return a full URL by prepending the baseUrl
 * if href does not start with http.
 * If href is null, return an empty string.
 * @param {string | null} href
 * @param {string} baseUrl
 * @returns {string}
 */
export function createFullUrl(href: string | null, baseUrl: string): string {
    if (!href) {
        // Handle null href gracefully, perhaps return an empty string or throw a more specific error
        return "";
    }

    return href.startsWith('http')
        ? href
        : new URL(href, baseUrl).href;
}


    /**
     * Extracts meme image data from the given page.
     * @param page The page to extract from
     * @returns A promise resolving to an array of MemeImageData objects
     */
export async function extractMemeImageData(page: Page): Promise<MemeImageData[]> {
    const rawImageData: MemeImageData[] = await page.$$eval('img.base-img', (imgs: Element[]) =>
        (imgs as HTMLImageElement[]).map(img => ({
            alt: img.alt,
            src: img.src
        }))
    );

    return rawImageData.map(data => ({
        ...data,
        alt: formatMemeAltText(data.alt)
    }));
}

export const tools = [
    {
        functionDeclarations: [
            {
                name: "search_meme",
                description: "Searches for a meme by name and returns its main page URL and a blank template image URL.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        memeName: {
                            type: Type.STRING,
                            description: "The exact name or a close name of the meme to search for, e.g., 'Distracted Boyfriend' or 'Chill guy'."
                        },
                    },
                    required: ["memeName"],
                },
            },
        ],
    },
    {
        functionDeclarations: [
            {
                name: "scrape_meme_images",
                description: "Scrapes example images (usually with text) from a given meme's full page URL.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        memePageUrl: {
                            type: Type.STRING,
                            description: "The blank template URL of the meme's page from which to scrape images (obtained from search_meme tool)."
                        },
                    },
                    required: ["memePageUrl"],
                },
            },
        ],
    }
];
// Helper function to check if error is retryable
export function isRetryableError(error: Error): boolean {
    if (!error?.cause) return false;

    // Retryable HTTP status codes
    const retryableStatuses = [429, 503, 500, 502, 504];
    return error.message.includes(retryableStatuses.toString());
}

// Helper function for exponential backoff delay
export function calculateDelay(attempt: number): number {
    const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
    return Math.min(delay, RETRY_CONFIG.maxDelay);
}

// Fallback function to generate basic meme info without AI
export function generateFallbackMemeInfo(
    memeName: string,
    memeSearchResult: MemeSearchResult,
    images: MemeImageData[]
): string {
    return `🎭 *Meme Information: "${memeName}"*

🌐 *Source Page:* ${memeSearchResult.memePageFullUrl}

🎨 *Blank Template:* ${memeSearchResult.memeBlankImgUrl}

📸 *Available Examples:* ${images?.length || 0} images

ℹ️ *Note:* AI services are currently busy, but we've gathered the essential meme data for you!`;
}

// Generate fallback origin story
export function generateFallbackOriginStory(memeName: string): string {
    return `📚 *Meme Origin: "${memeName}"*

🤖 AI analysis is currently unavailable due to high demand, but here's what we know:

🎭 "${memeName}" is a popular internet meme that has gained significant traction across social media platforms.

🌐 Like many internet memes, it likely originated from social media, forums, or popular culture references and spread through user sharing and remixing.

📈 The meme format allows users to express various emotions, reactions, or situations in a relatable and humorous way.

💡 *Tip:* You can still use the blank template below to create your own version of this meme!

⚡ *AI services will be back online soon for more detailed analysis.*`;
}


export function formatMemeNameForUrl(memeName: string): string {
    return memeName
        .trim()
        .split(/[\s-]+/) // Split by spaces or hyphens
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize first letter, rest lowercase
        .join('-'); // Join with hyphens
}