// src/utils/urlFormatter.ts
/**
 * Formats meme name for URL usage by converting spaces to hyphens
 * and handling special characters appropriately
 */
export const formatMemeNameForUrl = (memeName: string): string => {
    return memeName
        .trim()
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
};


/**
 * Formats meme name for display by capitalizing the first letter of each word.
 * @param memeName The input string to format.
 * @returns The formatted string.
 */
export const formatMemeNameForDisplay = (memeName: string): string => {
    if (!memeName) return '';
    return memeName
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export function extractMemeNameFromUrl(url: string): string | null {
    const match = url.match(/\/[^/]+\.jpg$/);
    return match ? match[1] : null;
}