import { Page } from 'playwright';
import { MemeSearchResult, MemeSearchResultSchema } from '../types';
import { UrlUtils } from '../utils';
import { appConfig } from '../config';

export class MemeSearchScraper {
    private static readonly SELECTORS = {
        SEARCH_INPUT: '#mm-search',
        RESULT_LINK: '.mm-rec-link',
        PREVIEW_IMAGE: '.mm-img.shadow',
    };

    private static readonly TIMEOUTS = {
        SEARCH_DELAY: 3000,
        ENTER_DELAY: 2000,
        SELECTOR_WAIT: 10000,
    };

    async searchMemeAndGetFirstLink(page: Page, memeName: string): Promise<MemeSearchResult | null> {
        try {
            await this.navigateToSearchPage(page);
            await this.performSearch(page, memeName);
            return await this.extractSearchResult(page);
        } catch (error) {
            console.error("Error during meme search:", error);
            return null;
        }
    }

    private async navigateToSearchPage(page: Page): Promise<void> {
        await page.goto(appConfig.MEME_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        await page.waitForTimeout(MemeSearchScraper.TIMEOUTS.SEARCH_DELAY);
    }

    private async performSearch(page: Page, memeName: string): Promise<void> {
        const searchInput = await page.$(MemeSearchScraper.SELECTORS.SEARCH_INPUT);
        if (!searchInput) {
            throw new Error("Search input not found");
        }

        await searchInput.fill(memeName);
        await page.waitForTimeout(MemeSearchScraper.TIMEOUTS.SEARCH_DELAY);
        await searchInput.press('Enter');
        await page.waitForTimeout(MemeSearchScraper.TIMEOUTS.ENTER_DELAY);
        await searchInput.press('Enter');
        await page.waitForTimeout(MemeSearchScraper.TIMEOUTS.SEARCH_DELAY);
    }

    private async extractSearchResult(page: Page): Promise<MemeSearchResult | null> {
        await page.waitForSelector(
            MemeSearchScraper.SELECTORS.RESULT_LINK,
            { timeout: MemeSearchScraper.TIMEOUTS.SELECTOR_WAIT }
        );

        const firstResultLink = await page.$(MemeSearchScraper.SELECTORS.RESULT_LINK);
        if (!firstResultLink) {
            throw new Error("First meme result link not found");
        }

        const memePageHref = await firstResultLink.getAttribute('href');
        const memePageFullUrl = UrlUtils.createFullUrl(memePageHref, appConfig.MEME_URL);

        const memePreviewImg = await page.$(MemeSearchScraper.SELECTORS.PREVIEW_IMAGE);
        const memePreviewSrc = memePreviewImg ? await memePreviewImg.getAttribute('src') : null;
        const memePreviewFullUrl = UrlUtils.createFullUrl(memePreviewSrc, appConfig.MEME_URL);

        const result = { memePageFullUrl, memePreviewFullUrl };

        // Validate the result
        const validationResult = MemeSearchResultSchema.safeParse(result);
        if (!validationResult.success) {
            console.error("Search result validation failed:", validationResult.error.issues);
            return null;
        }

        console.log("Meme preview image URL:", memePreviewFullUrl);
        console.log("First meme result link:", memePageFullUrl);

        return validationResult.data;
    }
}