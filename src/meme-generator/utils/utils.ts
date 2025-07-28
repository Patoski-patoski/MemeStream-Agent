// src/meme-generator/utils/utils.ts

import { Type } from "@google/genai";
import { Page } from 'playwright';
import { MemeImageData } from '../types/types.js';


function formatMemeAltText(text: string): string {
    // Split at first '|'
    const [title, rest] = text.split('|').map(s => s.trim());
    if (!rest) return title;

    // Split rest at first ';' or ',' or '|'
    const subtitle = rest.split(/[;|,]/)[0].trim();
    return `${title}-${subtitle}`;
}

export function createFullUrl(href: string | null, baseUrl: string): string {
    if (!href) {
        // Handle null href gracefully, perhaps return an empty string or throw a more specific error
        console.warn("createFullUrl received null href.");
        return "";
    }

    return href.startsWith('http')
        ? href
        : new URL(href, baseUrl).href;
}

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