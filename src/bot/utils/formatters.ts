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
