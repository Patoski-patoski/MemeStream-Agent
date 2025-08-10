// src/meme-generator/tools/meme-generator.tool.ts

import dotenv from "dotenv";
import { Page } from 'playwright';

import {  MemeImageData, MemeSearchResult } from '../types/types.js';
import { createFullUrl, extractMemeImageData } from '../utils/utils.js';

dotenv.config();

const MEME_SEARCH_URL: string = process.env.MEME_URL as string;
if (!MEME_SEARCH_URL) {
  throw new Error("MEME_URL environment variable is not set.");
}


  /**
   * Search for a meme with the given name on the configured meme search page
   * and return the first result's page URL and blank template URL.
   * @param {Page} page The Playwright page object to use for the search.
   * @param {string} memeName The name of the meme to search for.
   * @returns {Promise<MemeSearchResult | null>} A promise resolving to an object
   * with the meme page URL and blank template URL, or null if the search failed.
   */
export async function searchMemeAndGetFirstLink(page: Page, memeName: string): Promise<MemeSearchResult | null> {
  await page.goto(MEME_SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const searchInput = await page.$('#mm-search');
  if (!searchInput) {
    console.log("Search input #mm-search not found after loading.");
    return null;
  }

  await searchInput.fill(memeName);
  await page.waitForTimeout(2000);
  await searchInput.press('Enter');
  await searchInput.press('Enter');
  await page.waitForTimeout(2000);

  await page.waitForSelector('.mm-rec-link', { timeout: 30000 });

  const firstResultLink = await page.$(".mm-rec-link");
  if (!firstResultLink) {
    console.error("First meme result link not found.");
    return null;
  }
  
  const memePageHref = await firstResultLink.getAttribute('href');
  const memePageFullUrl = createFullUrl(memePageHref, MEME_SEARCH_URL);

  const memePreviewImg = await page.$(".mm-img.shadow");

  const memePreviewSrc = memePreviewImg ? await memePreviewImg.getAttribute('src') : null;
  const memeBlankImgUrl = createFullUrl(memePreviewSrc, MEME_SEARCH_URL);

  const result = { memePageFullUrl, memeBlankImgUrl };
  return result;
}

  /**
   * Scrape meme images from the given meme page URL.
   * @param {Page} page The Playwright page object to use for scraping.
   * @param {string} memePageUrl The URL of the meme page to scrape.
   * @returns {Promise<MemeImageData[]>} A promise resolving to an array of
   * MemeImageData objects containing the image URLs and alternative text.
   * The array is empty if no meme images were found on the page.
   */
export async function scrapeMemeImagesFromPage(page: Page, memePageUrl: string): Promise<MemeImageData[]>{
  await page.goto(memePageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(2000);

  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 500;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 300);
    });
  });
  await page.waitForTimeout(1000);

  const memeImages = await extractMemeImageData(page);
  if (!memeImages || memeImages.length === 0) {
    console.error("No meme images found on the page.");
    return [];
  }

  return memeImages;
}
