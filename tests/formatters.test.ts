
import { formatMemeNameForUrl } from '../src/utils/formatters';

describe('URL Formatters', () => {
    describe('formatMemeNameForUrl', () => {
        it('should replace spaces with hyphens', () => {
            expect(formatMemeNameForUrl('Distracted Boyfriend')).toBe('Distracted-Boyfriend');
        });

        it('should remove special characters', () => {
            expect(formatMemeNameForUrl('Buff Doge vs. Cheems!')).toBe('Buff-Doge-vs-Cheems');
        });

        it('should trim leading and trailing spaces', () => {
            expect(formatMemeNameForUrl('  Two Buttons  ')).toBe('Two-Buttons');
        });

        it('should handle multiple consecutive spaces', () => {
            expect(formatMemeNameForUrl('Expanding   Brain')).toBe('Expanding-Brain');
        });

        it('should handle multiple consecutive hyphens', () => {
            expect(formatMemeNameForUrl('Epic--Handshake')).toBe('Epic-Handshake');
        });

        it('should remove leading and trailing hyphens', () => {
            expect(formatMemeNameForUrl('-Drake-hotline-bling-')).toBe('Drake-hotline-bling');
        });

        it('should handle a combination of the above cases', () => {
            expect(formatMemeNameForUrl('  -!@#$This is a test^&*()-_  ')).toBe('This-is-a-test');
        });
    });
});
