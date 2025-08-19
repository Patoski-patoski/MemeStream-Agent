// src/meme-generator/tools/meme-generator.tool.ts

import dotenv from "dotenv";
import { Page } from 'playwright';

import { MemeImageData, MemeSearchResult } from '../types/types.js';
import { createFullUrl, extractMemeImageData } from '../utils/utils.js';
import { TIMEOUTS, SELECTORS } from "../utils/constants.js";

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Configuration constants
const MEME_SEARCH_URL: string = process.env.MEME_URL as string;


// Validation
if (!MEME_SEARCH_URL) {
  throw new Error("MEME_URL environment variable is not set.");
}

/**
 * Custom error for meme generation operations
 */
class MemeGeneratorError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = 'MemeGeneratorError';
  }
}

/**
 * Performs a search operation with retry logic
 */
async function performSearch(page: Page, memeName: string): Promise<void> {
  const searchInput = await page.$(SELECTORS.SEARCH_INPUT);
  if (!searchInput) {
    throw new MemeGeneratorError("Search input not found on page", "search");
  }

  await searchInput.fill(memeName);
  await page.waitForTimeout(TIMEOUTS.SEARCH_WAIT);

  // Double Enter press for speed
  await searchInput.press('Enter');
  await searchInput.press('Enter');
  await page.waitForTimeout(TIMEOUTS.SEARCH_WAIT);
}

/**
 * Extracts meme data from search results
 */
async function extractMemeData(page: Page): Promise<MemeSearchResult> {
  await page.waitForSelector(SELECTORS.FIRST_RESULT, {
    timeout: TIMEOUTS.ELEMENT_WAIT
  });

  const firstResultLink = await page.$(SELECTORS.FIRST_RESULT);
  if (!firstResultLink) {
    throw new MemeGeneratorError("No search results found", "extract");
  }

  const memePageHref = await firstResultLink.getAttribute('href');
  const memePageFullUrl = createFullUrl(memePageHref, MEME_SEARCH_URL);

  // Get preview image with better error handling
  const memePreviewImg = await page.$(SELECTORS.PREVIEW_IMAGE);
  const memePreviewSrc = memePreviewImg
    ? await memePreviewImg.getAttribute('src')
    : null;

  const memeBlankImgUrl = createFullUrl(memePreviewSrc, MEME_SEARCH_URL);

  return { memePageFullUrl, memeBlankImgUrl };
}

/**
 * Search for a meme with the given name and return the first result's data.
 * @param page The Playwright page object to use for the search.
 * @param memeName The name of the meme to search for.
 * @returns A promise resolving to meme search result data or null if search failed.
 */
export async function searchMemeAndGetFirstLink(
  page: Page,
  memeName: string
): Promise<MemeSearchResult | null> {
  try {
    // Navigate to search page
    await page.goto(MEME_SEARCH_URL, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.PAGE_LOAD
    });

    // Perform search
    await performSearch(page, memeName);

    // Extract and return data
    return await extractMemeData(page);

  } catch (error) {
    if (error instanceof MemeGeneratorError) {
      console.error(`Meme search failed (${error.operation}): ${error.message}`);
    } else {
      console.error("Unexpected error during meme search:", error);
    }
    return null;
  }
}

/**
 * Optimized page scrolling with better performance
 */
async function scrollToLoadContent(page: Page): Promise<void> {
  await page.evaluate(async () => {
    return new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 500; 
      const scrollDelay = 300; 

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, scrollDelay);
    });
  });
}

/**
 * Scrape meme images from the given meme page URL with improved error handling.
 * @param page The Playwright page object to use for scraping.
 * @param memePageUrl The URL of the meme page to scrape.
 * @returns A promise resolving to an array of MemeImageData objects.
 */
export async function scrapeMemeImagesFromPage(
  page: Page,
  memePageUrl: string
): Promise<MemeImageData[]> {
  try {
    // Navigate to meme page
    await page.goto(memePageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.ELEMENT_WAIT
    });

    // Brief wait for initial content
    await page.waitForTimeout(TIMEOUTS.PAGE_LOAD);

    // Scroll to load all images
    await scrollToLoadContent(page);

    // Final wait for images to load
    await page.waitForTimeout(TIMEOUTS.ELEMENT_WAIT);

    // Extract meme image data
    const memeImages = await extractMemeImageData(page);

    if (!memeImages?.length) {
      console.warn(`No meme images found on page: ${memePageUrl}`);
      return [];
    }

    console.log(`Successfully scraped ${memeImages.length} meme images`);
    return memeImages;

  } catch (error) {
    console.error(`Failed to scrape memes from ${memePageUrl}:`, error);
    return [];
  }
}

/**
 * Complete meme generation workflow: search and scrape
 * @param page The Playwright page object
 * @param memeName The name of the meme to search for
 * @returns Promise resolving to array of meme image data
 */
export async function generateMemeData(
  page: Page,
  memeName: string
): Promise<MemeImageData[]> {
  // Search for meme
  const searchResult = await searchMemeAndGetFirstLink(page, memeName);
  if (!searchResult) {
    console.error(`Failed to find meme: ${memeName}`);
    return [];
  }

  // Scrape meme images
  return await scrapeMemeImagesFromPage(page, searchResult.memePageFullUrl);
}