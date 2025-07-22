//src/mastra/agents/meme-generator/tools/meme-generator.tool.ts

import { config } from 'dotenv';
import { Page } from 'playwright';

import {
  MemeImageData,  
  MemeSearchResult,
} from '../types/types';
import { createFullUrl, extractMemeImageData } from '../utils/utils';

config();

const MEME_SEARCH_URL: string = process.env.MEME_URL || "https://imgflip.com/memegenerator";

export async function searchMemeAndGetFirstLink(page: Page, memeName: string): Promise<MemeSearchResult | null> {
  await page.goto(MEME_SEARCH_URL!, { waitUntil: 'domcontentloaded', timeout: 30000 });

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
