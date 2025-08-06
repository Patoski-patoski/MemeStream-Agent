import { jest } from '@jest/globals';
import { GoogleGenAI } from "@google/genai";
import { Page } from 'playwright';
import { MemeSearchResult, MemeImageData } from '../src/meme-generator/types/types';

// Mock external modules
jest.mock('dotenv', () => ({
    config: jest.fn(),
}));

// Mock the GoogleGenAI instance and its methods
const mockGenerateContent = jest.fn();
const mockGenerateContentStream = jest.fn();

jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: {
            generateContent: mockGenerateContent,
            generateContentStream: mockGenerateContentStream,
        },
    })),
}));

// Mock the Playwright Page object
const mockPage = {
    goto: jest.fn(),
    $: jest.fn(),
    fill: jest.fn(),
    press: jest.fn(),
    waitForTimeout: jest.fn(),
    waitForSelector: jest.fn(),
    getAttribute: jest.fn(),
    evaluate: jest.fn(),
    $$eval: jest.fn(),
};

// Mock the browser functions directly within jest.mock
export const mockGetOptimizedPage = jest.fn();
export const mockClosePage = jest.fn();
export const mockGetMemoryUsage = jest.fn();
export const mockInitializeBrowser = jest.fn();

jest.mock('../src/bot/core/browser', () => ({
    getOptimizedPage: mockGetOptimizedPage,
    closePage: mockClosePage,
    getMemoryUsage: mockGetMemoryUsage,
    initializeBrowser: mockInitializeBrowser,
}));

// Mock the tool functions
const mockSearchMemeAndGetFirstLink = jest.fn();
const mockScrapeMemeImagesFromPage = jest.fn();

jest.mock('../src/meme-generator/tools/meme-generator-tools', () => ({
    searchMemeAndGetFirstLink: mockSearchMemeAndGetFirstLink,
    scrapeMemeImagesFromPage: mockScrapeMemeImagesFromPage,
}));

// Import the module under test AFTER all its dependencies are mocked
import { runMemeAgent } from '../src/meme-generator/agents/memegeneratorAgent';

let mockResponseHandler: { sendUpdate: jest.Mock; sendImages: jest.Mock; };

describe('runMemeAgent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset process.env for each test to avoid interference
        process.env.MODEL_NAME = 'gemini-pro';
        process.env.GEMINI_API_KEY = 'test-api-key';
        process.env.TAG_MEME = 'https://imgflip.com/tag/meme';

        // Set mock return values for browser functions
        mockGetOptimizedPage.mockResolvedValue(mockPage);
        mockClosePage.mockResolvedValue(undefined);
        mockGetMemoryUsage.mockReturnValue({ rss: 100, heapTotal: 200, heapUsed: 50 });
        mockInitializeBrowser.mockResolvedValue(undefined);

        // Initialize mockResponseHandler for each test
        mockResponseHandler = {
            sendUpdate: jest.fn(),
            sendImages: jest.fn(),
        };
    });

    it('should successfully search for a meme, scrape images, and send a summary', async () => {
        const memeNameInput = 'Distracted Boyfriend';
        const requestId = 'test-request-id';

        // Mock AI responses for step 1 (search_meme tool call)
        mockGenerateContent.mockResolvedValueOnce({
            candidates: [
                {
                    content: {
                        role: 'model',
                        parts: [
                            {
                                functionCall: {
                                    name: 'search_meme',
                                    args: { memeName: memeNameInput },
                                },
                            },
                        ],
                    },
                },
            ],
        });

        // Mock searchMemeAndGetFirstLink tool function
        const mockMemeSearchResult: MemeSearchResult = {
            memePageFullUrl: 'https://imgflip.com/meme/Distracted-Boyfriend',
            memeBlankImgUrl: 'https://imgflip.com/s/meme/Distracted-Boyfriend.jpg',
        };
        mockSearchMemeAndGetFirstLink.mockResolvedValue(mockMemeSearchResult);

        // Mock AI responses for step 3 (scrape_meme_images tool call)
        mockGenerateContent.mockResolvedValueOnce({
            candidates: [
                {
                    content: {
                        role: 'model',
                        parts: [
                            {
                                functionCall: {
                                    name: 'scrape_meme_images',
                                    args: { memePageUrl: mockMemeSearchResult.memePageFullUrl },
                                },
                            },
                        ],
                    },
                },
            ],
        });

        // Mock scrapeMemeImagesFromPage tool function
        const mockScrapedImages: MemeImageData[] = [
            { src: 'https://i.imgflip.com/db1.jpg', alt: 'Distracted Boyfriend 1' },
            { src: 'https://i.imgflip.com/db2.jpg', alt: 'Distracted Boyfriend 2' },
        ];
        mockScrapeMemeImagesFromPage.mockResolvedValue(mockScrapedImages);

        // Mock AI responses for step 4 (origin story stream)
        mockGenerateContentStream.mockResolvedValueOnce({
            [Symbol.asyncIterator]: async function* () {
                yield { text: 'This is the origin story part 1.' };
                yield { text: 'This is the origin story part 2.' };
            },
        });

        // Mock AI responses for step 5 (final summary)
        mockGenerateContent.mockResolvedValueOnce({
            text: 'Final summary of Distracted Boyfriend meme.',
        });

        const result = await runMemeAgent(memeNameInput, mockResponseHandler, requestId);

        // Assertions
        expect(mockGetOptimizedPage).toHaveBeenCalledWith(requestId);
        expect(mockGenerateContent).toHaveBeenCalledTimes(3); // 3 calls for search, scrape, final summary
        expect(mockGenerateContentStream).toHaveBeenCalledTimes(1); // 1 call for origin story

        expect(mockSearchMemeAndGetFirstLink).toHaveBeenCalledWith(mockPage, memeNameInput);
        expect(mockScrapeMemeImagesFromPage).toHaveBeenCalledWith(mockPage, mockMemeSearchResult.memePageFullUrl);

        expect(mockResponseHandler.sendUpdate).toHaveBeenCalledWith('This is the origin story part 1.This is the origin story part 2.');
        expect(mockResponseHandler.sendUpdate).toHaveBeenCalledWith('Final summary of Distracted Boyfriend meme.');
        expect(mockResponseHandler.sendImages).toHaveBeenCalledWith(mockScrapedImages);

        expect(mockClosePage).toHaveBeenCalledWith(requestId);

        expect(result).toEqual({
            summary: 'Final summary of Distracted Boyfriend meme.',
            images: mockScrapedImages,
            memePageUrl: mockMemeSearchResult.memePageFullUrl,
            blankMemeUrl: mockMemeSearchResult.memeBlankImgUrl,
            originStory: 'This is the origin story part 1.This is the origin story part 2.',
        });
    }, 150000); // Increased timeout to 50 seconds
});
