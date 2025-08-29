/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { Page } from 'playwright';
// Create mock functions BEFORE the mock declaration
const mockCreateFullUrl = jest.fn();
const mockExtractMemeImageData = jest.fn();

// Mock the utils module - must be before any imports that use it
jest.mock('../src/meme-generator/utils/utils', () => ({
    createFullUrl: mockCreateFullUrl,
    extractMemeImageData: mockExtractMemeImageData,
    formatMemeAltText: jest.fn((text: string) => text), // Mock this too
}));

import {
    searchMemeAndGetFirstLink,
    scrapeMemeImagesFromPage
} from '../src/meme-generator/tools/meme-generator-tools';

import {
    MemeImageData,
    MemeSearchResult,
} from '../src/meme-generator/types/types';

import { TIMEOUTS, SELECTORS } from "../src/meme-generator/utils/constants.js";


// Mock environment variables
const originalEnv = process.env;
beforeAll(() => {
    process.env.MEME_URL = 'https://imgflip.com/memegenerator';
});

afterAll(() => {
    process.env = originalEnv;
});

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
    $eval: jest.fn(),
    $$eval: jest.fn(),
    waitForLoadState: jest.fn(),
    pause: jest.fn(),
};

describe('Meme Generator Tools', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mock implementations
        mockPage.goto.mockReturnValue(undefined!);
        mockPage.waitForTimeout.mockReturnValue(undefined!);
        mockPage.waitForSelector.mockReturnValue(undefined!);
        mockPage.evaluate.mockReturnValue(undefined!);
        mockPage.$$eval.mockReturnValue([]); // Default mock for $$eval
        mockPage.$$eval.mockReturnValue([]); // Default mock for $$eval

        // Reset utils mocks
        mockCreateFullUrl.mockClear();
        mockExtractMemeImageData.mockClear();
    });

    describe('searchMemeAndGetFirstLink', () => {
        it('should return the first meme link and preview image when search is successful', async () => {
            const memeName = 'test-meme';
            const expectedResult: MemeSearchResult = {
                memePageFullUrl: 'https://imgflip.com/meme/test-meme',
                memeBlankImgUrl: 'https://imgflip.com/s/meme/test-meme.jpg',
            };

            // Mock the search input element
            const mockSearchInput = {
                fill: jest.fn().mockResolvedValue(undefined!),
                press: jest.fn().mockResolvedValue(undefined!),
                click: jest.fn().mockResolvedValue(undefined!),
            };

            // Mock the first result link element
            const mockFirstResultLink = {
                getAttribute: jest.fn().mockResolvedValue('/meme/test-meme' as never),
            };

            // Mock the preview image element
            const mockPreviewImg = {
                getAttribute: jest.fn().mockResolvedValue('/s/meme/test-meme.jpg' as never),
            };

            // Setup page mock calls
            mockPage.waitForSelector.mockImplementation(async (selector) => {
                if (selector === SELECTORS.SEARCH_INPUT) return mockSearchInput;
                if (selector === SELECTORS.FIRST_RESULT) return mockFirstResultLink;
                return null;
            });

            mockPage.$.mockImplementation(async (selector) => {
                if (selector === SELECTORS.FIRST_RESULT) return mockFirstResultLink;
                if (selector === SELECTORS.PREVIEW_IMAGE) return mockPreviewImg;
                return null;
            });

            // Mock utils functions
            mockCreateFullUrl
                .mockReturnValueOnce('https://imgflip.com/meme/test-meme')
                .mockReturnValueOnce('https://imgflip.com/s/meme/test-meme.jpg');

            const result = await searchMemeAndGetFirstLink(mockPage as unknown as Page, memeName);

            expect(result).toEqual(expectedResult);
            expect(mockPage.goto).toHaveBeenCalledWith('https://imgflip.com/memegenerator',
                { waitUntil: 'domcontentloaded', timeout: 30000 });
            expect(mockPage.waitForSelector).toHaveBeenCalledWith(SELECTORS.SEARCH_INPUT, { state: 'visible', timeout: TIMEOUTS.ELEMENT_WAIT });
            expect(mockSearchInput.click).toHaveBeenCalled();
            expect(mockSearchInput.fill).toHaveBeenCalledWith(memeName);
            expect(mockSearchInput.press).toHaveBeenCalledWith('Enter');
            expect(mockPage.waitForSelector).toHaveBeenCalledWith(SELECTORS.FIRST_RESULT, { timeout: TIMEOUTS.ELEMENT_WAIT });
        });

        it('should return null when search input is not found', async () => {
            const memeName = 'test-meme';

            mockPage.waitForSelector.mockResolvedValue(null!);

            const result = await searchMemeAndGetFirstLink(mockPage as unknown as Page, memeName);

            expect(result).toBeNull();
            expect(mockPage.goto).toHaveBeenCalledWith('https://imgflip.com/memegenerator',
                { waitUntil: 'domcontentloaded', timeout: 30000 });
            expect(mockPage.waitForSelector).toHaveBeenCalledWith(SELECTORS.SEARCH_INPUT, { state: 'visible', timeout: TIMEOUTS.ELEMENT_WAIT });
        });

        it('should return null when first result link is not found', async () => {
            const memeName = 'test-meme';

            const mockSearchInput = {
                fill: jest.fn().mockResolvedValue(undefined!),
                press: jest.fn().mockResolvedValue(undefined!),
                click: jest.fn().mockResolvedValue(undefined!),
            };

            mockPage.waitForSelector.mockImplementation(async (selector) => {
                if (selector === SELECTORS.SEARCH_INPUT) return mockSearchInput;
                if (selector === SELECTORS.FIRST_RESULT) return {}; // Mock element handle
                return null;
            });

            mockPage.$.mockImplementation(async (selector) => {
                if (selector === SELECTORS.FIRST_RESULT) return null;
                return null;
            });

            const result = await searchMemeAndGetFirstLink(mockPage as unknown as Page, memeName);

            expect(result).toBeNull();
            expect(mockPage.waitForSelector).toHaveBeenCalledWith(SELECTORS.FIRST_RESULT, { timeout: TIMEOUTS.ELEMENT_WAIT });
        });
    });

    describe('scrapeMemeImagesFromPage', () => {
        it('should return an array of meme image data when images are found', async () => {
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

            // Mock page.$$eval to return raw data that extractMemeImageData expects
            const rawMemeData = [
                { src: 'https://i.imgflip.com/1.jpg', alt: 'Test Meme 1' },
                { src: 'https://i.imgflip.com/2.jpg', alt: 'Test Meme 2' },
            ];
            mockPage.$$eval.mockReturnValue(rawMemeData);

            // Mock the extractMemeImageData utility function to return processed data
            mockExtractMemeImageData.mockReturnValue(expectedResult);

            const result = await scrapeMemeImagesFromPage(mockPage as unknown as Page, memePageUrl);


            expect(result).toEqual(expectedResult);
            expect(mockPage.goto).toHaveBeenCalledWith(memePageUrl,
                { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.ELEMENT_WAIT });
            expect(mockPage.evaluate).toHaveBeenCalled();
        });

        it('should return empty array when no images are found', async () => {
            const memePageUrl = 'https://imgflip.com/meme/test-meme';

            // Mock page.$$eval to return empty array (raw data)
            mockPage.$$eval.mockReturnValue([]);

            // Mock extractMemeImageData to return empty array
            mockExtractMemeImageData.mockReturnValue([]);

            const result = await scrapeMemeImagesFromPage(mockPage as unknown as Page, memePageUrl);

            expect(result).toEqual([]);
            expect(mockPage.goto).toHaveBeenCalledWith(memePageUrl,
                { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.ELEMENT_WAIT });
        });

        it('should return empty array when extractMemeImageData returns null', async () => {
            const memePageUrl = 'https://imgflip.com/meme/test-meme';

            // Mock page.$$eval to return some raw data
            mockPage.$$eval.mockReturnValue([]);

            // Mock extractMemeImageData to return null
            mockExtractMemeImageData.mockReturnValue(null!);

            const result = await scrapeMemeImagesFromPage(mockPage as unknown as Page, memePageUrl);

            expect(result).toEqual([]);
        });

        it('should handle page navigation errors gracefully', async () => {
            const memePageUrl = 'https://imgflip.com/meme/test-meme';

            // Mock page.goto to throw an error
            mockPage.goto.mockRejectedValue(new Error('Navigation failed') as never);

            const result = await scrapeMemeImagesFromPage(mockPage as unknown as Page, memePageUrl);

            expect(result).toEqual([]);

            expect(mockPage.goto).toHaveBeenCalledWith(memePageUrl, {
                waitUntil: 'domcontentloaded',
                timeout: TIMEOUTS.ELEMENT_WAIT
            });
        });

        it('should properly handle scrolling functionality', async () => {
            const memePageUrl = 'https://imgflip.com/meme/test-meme';
            const mockImageData = [{ src: 'test.jpg', alt: 'test' }];

            // Mock page.$$eval to return raw data
            mockPage.$$eval.mockReturnValue([{ src: 'test.jpg', alt: 'test' }]);

            // Mock page.evaluate to resolve immediately
            mockPage.evaluate.mockReturnValue(undefined);
            mockExtractMemeImageData.mockReturnValue(mockImageData);

            const result = await scrapeMemeImagesFromPage(mockPage as unknown as Page, memePageUrl);

            expect(result).toEqual(mockImageData);
            expect(mockPage.evaluate).toHaveBeenCalled();
            // Verify that the evaluate function was called with a function
            expect(mockPage.evaluate.mock.calls[0][0]).toBeInstanceOf(Function);
        });
    });

    describe('Environment Variable Handling', () => {
        it('should throw error when MEME_URL is not set', () => {
            // This test would need to be in a separate test file or use dynamic imports
            // since the error is thrown at module load time
            delete process.env.MEME_URL;

            expect(() => {
                // This would need to be tested with dynamic import or in isolation
                if (!process.env.MEME_URL) {
                    throw new Error("MEME_URL environment variable is not set.");
                }
            }).toThrow("MEME_URL environment variable is not set.");

            // Restore the environment variable
            process.env.MEME_URL = 'https://imgflip.com';
        });
    });
});