//src/mastra/agents/meme-generator/scrapers/meme-images.scraper.ts

import { Page } from 'playwright';
import { MemeImageData, RawImageData, RawImageDataSchema } from '../types';
import { MemeUtils } from '../utils/utils';

export class MemeImagesScraper {
  private static readonly SELECTORS = {
    MEME_IMAGES: 'img.base-img',
  };

  private static readonly SCROLL_CONFIG = {
    DISTANCE: 500,
    INTERVAL: 300,
    FINAL_WAIT: 2000,
  };

  async scrapeMemeImagesFromPage(page: Page, memePageUrl: string): Promise<MemeImageData[]> {
    try {
      await this.navigateToMemePage(page, memePageUrl);
      await this.scrollToLoadAllImages(page);
      return await this.extractMemeImageData(page);
    } catch (error) {
      console.error("Error scraping meme images:", error);
      return [];
    }
  }

  private async navigateToMemePage(page: Page, memePageUrl: string): Promise<void> {
    await page.goto(memePageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(3000);
  }

  private async scrollToLoadAllImages(page: Page): Promise<void> {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 500; // MemeImagesScraper.SCROLL_CONFIG.DISTANCE
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 300); // MemeImagesScraper.SCROLL_CONFIG.INTERVAL
      });
    });

    await page.waitForTimeout(MemeImagesScraper.SCROLL_CONFIG.FINAL_WAIT);
  }

  private async extractMemeImageData(page: Page): Promise<MemeImageData[]> {
    const rawImageData = await page.$eval(
      MemeImagesScraper.SELECTORS.MEME_IMAGES,
      (imgs: HTMLImageElement[]) =>
        imgs.map(img => ({
          alt: img.alt,
          src: img.src
        }))
    );

    console.log("Raw image data extracted:", rawImageData);

    // Validate raw image data
    const validatedRawData: RawImageData[] = [];
    for (const data of rawImageData) {
      const validationResult = RawImageDataSchema.safeParse(data);
      if (validationResult.success) {
        validatedRawData.push(validationResult.data);
      } else {
        console.warn("Invalid image data skipped:", validationResult.error.issues);
      }
    }

    if (validatedRawData.length === 0) {
      console.error("No valid meme images found on the page.");
      return [];
    }

    return validatedRawData.map(data => ({
      ...data,
      alt: MemeUtils.formatMemeAltText(data.alt)
    }));
  }
}