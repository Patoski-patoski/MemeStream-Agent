import { jest } from '@jest/globals';
import { Page } from 'playwright';
import {
    createFullUrl,
    extractMemeImageData,
    formatMemeAltText
} from '../src/meme-generator/utils/utils';

import { MemeImageData, MockPage } from '../src/meme-generator/types/types';

// Mock the Page object from Playwright with proper typing
const mockPage: Partial<MockPage> = {
    $eval: jest.fn(),
    $$eval: jest.fn(),
};


describe('Meme Generator Utils', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createFullUrl', () => {
        it('should return the href if it starts with http', () => {
            const href = 'https://example.com/image.jpg';
            const baseUrl = 'https://base.com';
            expect(createFullUrl(href, baseUrl)).toBe(href);
        });

        it('should create a full URL from a relative href', () => {
            const href = '/image.jpg';
            const baseUrl = 'https://example.com';
            const expectedUrl = 'https://example.com/image.jpg';
            expect(createFullUrl(href, baseUrl)).toBe(expectedUrl);
        });

        it('should return an empty string for a null href', () => {
            const baseUrl = 'https://example.com';
            expect(createFullUrl(null, baseUrl)).toBe('');
        });
    });

    describe('formatMemeAltText', () => {
        it('should return only the title if no subtitle is present', () => {
            expect(formatMemeAltText('Meme Title')).toBe('Meme Title');
        });

        it('should format with hyphen if subtitle is present after |', () => {
            expect(formatMemeAltText('Meme Title | Subtitle')).toBe('Meme Title-Subtitle');
        });

        it('should format with hyphen if subtitle is present after ;', () => {
            expect(formatMemeAltText('Meme Title ; Subtitle')).toBe('Meme Title ; Subtitle');
        });

        it('should format with hyphen if subtitle is present after ,', () => {
            expect(formatMemeAltText('Meme Title , Subtitle')).toBe('Meme Title , Subtitle');
        });

        it('should trim whitespace from title and subtitle', () => {
            expect(formatMemeAltText('  Meme Title   |   Subtitle  ')).toBe('Meme Title-Subtitle');
        });

        it('should handle multiple delimiters, taking the first one', () => {
            expect(formatMemeAltText('Meme Title | Subtitle ; Another')).toBe('Meme Title-Subtitle');
        });

        it('should return empty string if input is empty', () => {
            expect(formatMemeAltText('')).toBe('');
        });
    });

    describe('extractMemeImageData', () => {
        it('should return an array of meme image data', async () => {
            const rawImageData = [
                {
                    src: 'https://i.imgflip.com/1.jpg',
                    alt: 'Test Meme 1 | Original Text',
                },
                {
                    src: 'https://i.imgflip.com/2.jpg',
                    alt: 'Test Meme 2 | Original Text',
                },
            ];

            const expectedResult: MemeImageData[] = [
                {
                    src: 'https://i.imgflip.com/1.jpg',
                    alt: 'Test Meme 1-Original Text',
                },
                {
                    src: 'https://i.imgflip.com/2.jpg',
                    alt: 'Test Meme 2-Original Text',
                },
            ];

            (mockPage.$$eval as jest.Mock).mockReturnValue(rawImageData);

            const result = await extractMemeImageData(mockPage as Page);
            expect(result).toEqual(expectedResult);
            expect(mockPage.$$eval).toHaveBeenCalledWith('img.base-img', expect.any(Function));
        });

        it('should return an empty array if no images are found', async () => {
            (mockPage.$$eval as jest.Mock).mockReturnValue([]);

            const result = await extractMemeImageData(mockPage as Page);
            expect(result).toEqual([]);
            expect(mockPage.$$eval).toHaveBeenCalledWith('img.base-img', expect.any(Function));
        });

        it('should format alt text correctly using formatMemeAltText', async () => {
            const rawImageData = [
                {
                    src: 'https://i.imgflip.com/test.jpg',
                    alt: 'Complex Title | Subtitle ; Another Part, Final',
                },
            ];

            const expectedResult: MemeImageData[] = [
                {
                    src: 'https://i.imgflip.com/test.jpg',
                    alt: 'Complex Title-Subtitle',
                },
            ];

            (mockPage.$$eval as jest.Mock).mockReturnValue(rawImageData);

            const result = await extractMemeImageData(mockPage as Page);
            expect(result).toEqual(expectedResult);
            expect(mockPage.$$eval).toHaveBeenCalledWith('img.base-img', expect.any(Function));
        });
    });
});