
import { chromium, Browser, Page } from 'playwright';
import { MemeSearchScraper } from '../scrapers/meme-search.scraper';
import { MemeImagesScraper } from '../scrapers/meme-images.scraper';
import { MemeInput, MemeInputSchema, MemeImageData } from '../types';
import { UrlUtils } from '../utils/utils';
import { appConfig } from '../../../config';

export class MemeScraperService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private memeSearchScraper: MemeSearchScraper;
  private memeImagesScraper: MemeImagesScraper;

  constructor() {
    this.memeSearchScraper = new MemeSearchScraper();
    this.memeImagesScraper = new MemeImagesScraper();
  }

  async initialize(): Promise<void> {
    this.browser = await chromium.launch();
    this.page = await this.browser.newPage();
  }

  async scrapeMemesForQuery(input: MemeInput): Promise<MemeImageData[]> {
    // Validate input
    const validationResult = MemeInputSchema.safeParse(input);
    if (!validationResult.success) {
      console.error("Input validation failed:", validationResult.error.issues);
      return [];
    }

    if (!this.page) {
      throw new Error("Service not initialized. Call initialize() first.");
    }

    try {
      const searchResult = await this.memeSearchScraper.searchMemeAndGetFirstLink(
        this.page,
        validationResult.data.memeName
      );

      if (!searchResult) {
        console.log("Could not get meme search results.");
        return [];
      }

      const memePageUrl = searchResult.memePageFullUrl.startsWith('http')
        ? searchResult.memePageFullUrl
        : UrlUtils.createFullUrl(searchResult.memePageFullUrl, appConfig.MEME_URL);

      const memeImages = await this.memeImagesScraper.scrapeMemeImagesFromPage(
        this.page,
        memePageUrl
      );

      console.log("Meme preview image (first result):", searchResult.memePreviewFullUrl);

      return memeImages;
    } catch (error) {
      console.error("Error during meme scraping:", error);
      return [];
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}