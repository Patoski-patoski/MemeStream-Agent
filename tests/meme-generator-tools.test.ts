
import { jest } from '@jest/globals';
import { searchMemeAndGetFirstLink, scrapeMemeImagesFromPage } from '../src/meme-generator/tools/meme-generator-tools';
import { MemeImageData, MemeSearchResult } from '../src/meme-generator/types/types';

// Mock the Page object from Playwright
const mockPage = {
    goto: jest.fn(),
    $: jest.fn(),
    fill: jest.fn(),
    press: jest.fn(),
    waitForTimeout: jest.fn(),
    waitForSelector: jest.fn(),
    getAttribute: jest.fn(),
    evaluate: jest.fn(),
    url: jest.fn(),
    content: jest.fn(),
    title: jest.fn(),
    close: jest.fn(),
    exposeFunction: jest.fn(),
    setDefaultNavigationTimeout: jest.fn(),
    setDefaultTimeout: jest.fn(),
    setViewportSize: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
    isClosed: jest.fn(),
    video: jest.fn(),
    context: jest.fn(),
    mainFrame: jest.fn(),
    frames: jest.fn(),
    workers: jest.fn(),
    bringToFront: jest.fn(),
    emulateMedia: jest.fn(),
    screenshot: jest.fn(),
    pdf: jest.fn(),
    addScriptTag: jest.fn(),
    addStyleTag: jest.fn(),
    setContent: jest.fn(),
    selectOption: jest.fn(),
    check: jest.fn(),
    uncheck: jest.fn(),
    click: jest.fn(),
    dblclick: jest.fn(),
    hover: jest.fn(),
    tap: jest.fn(),
    focus: jest.fn(),
    type: jest.fn(),
    waitForEvent: jest.fn(),
    waitForFunction: jest.fn(),
    waitForNavigation: jest.fn(),
    waitForRequest: jest.fn(),
    waitForResponse: jest.fn(),
    goBack: jest.fn(),
    goForward: jest.fn(),
    reload: jest.fn(),
    route: jest.fn(),
    unroute: jest.fn(),
    $$: jest.fn(),
    $$eval: jest.fn(),
    $eval: jest.fn(),
    waitForLoadState: jest.fn(),
    pause: jest.fn(),
};

describe('Meme Generator Tools', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('searchMemeAndGetFirstLink', () => {
        it('should return the first meme link and preview image', async () => {
            const memeName = 'test-meme';
            const expectedResult: MemeSearchResult = {
                memePageFullUrl: 'https://imgflip.com/meme/test-meme',
                memeBlankImgUrl: 'https://imgflip.com/s/meme/test-meme.jpg',
            };

            // Mock the playwright page methods
            mockPage.$.mockResolvedValueOnce({ // for search input
                fill: jest.fn().mockResolvedValue(undefined),
                press: jest.fn().mockResolvedValue(undefined),
            } as any);
            mockPage.$.mockResolvedValueOnce({ // for first result link
                getAttribute: jest.fn().mockResolvedValue('/meme/test-meme'),
            } as any);
            mockPage.$.mockResolvedValueOnce({ // for meme preview image
                getAttribute: jest.fn().mockResolvedValue('/s/meme/test-meme.jpg'),
            } as any);

            const result = await searchMemeAndGetFirstLink(mockPage as any, memeName);

            expect(result).toEqual(expectedResult);
            expect(mockPage.goto).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
            expect(mockPage.$).toHaveBeenCalledWith('#mm-search');
            expect(mockPage.$).toHaveBeenCalledWith('.mm-rec-link');
            expect(mockPage.$).toHaveBeenCalledWith('.mm-img.shadow');
        });
    });

    describe('scrapeMemeImagesFromPage', () => {
        it('should return an array of meme image data', async () => {
            const memePageUrl = 'https://imgflip.com/meme/test-meme';
            const expectedResult: MemeImageData[] = [
                {
                    src: 'https://i.imgflip.com/1.jpg',
                    alt: 'Test Meme 1',
                },
                {
                    src: 'https://i.imgflip.com/2.jpg',
                    alt: 'Test Meme 2',
                },
            ];

            // Mock the playwright page methods
            mockPage.evaluate.mockResolvedValue(undefined); // for scrolling
            (mockPage as any).$eval = jest.fn().mockResolvedValue([
                {
                    src: 'https://i.imgflip.com/1.jpg',
                    alt: 'Test Meme 1',
                },
                {
                    src: 'https://i.imgflip.com/2.jpg',
                    alt: 'Test Meme 2',
                },
            ]);


            const result = await scrapeMemeImagesFromPage(mockPage as any, memePageUrl);
            expect(result).toEqual(expectedResult);
            expect(mockPage.goto).toHaveBeenCalledWith(memePageUrl, expect.any(Object));
            expect(mockPage.evaluate).toHaveBeenCalled();
        });
    });
});
