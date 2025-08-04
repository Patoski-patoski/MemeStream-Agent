// src/utils/urlFormatter.ts

const MEME_URL = process.env.MEME_URL;

/**
 * Formats meme name for URL usage by converting spaces to hyphens
 * and handling special characters appropriately
 */
export const formatMemeNameForUrl = (memeName: string): string => {
    return encodeURIComponent( memeName
        .trim()                           // Remove leading/trailing spaces
        .replace(/\s+/g, '-')            // Replace one or more spaces with single hyphen
        .replace(/[^\w\-]/g, '')         // Remove special characters except word chars and hyphens
        .replace(/--+/g, '-')            // Replace multiple consecutive hyphens with single hyphen
        .replace(/^-+|-+$/g, ''));       // Remove leading/trailing hyphens
    // Remove leading/trailing hyphens
};

/**
 * Alternative formatter that preserves more characters (for different URL structures)
 * 
 */
// export const formatMemeNameForUrlAlternative = (memeName: string): string => {
//     return memeName
//         .trim()
//         .replace(/\s+/g, '-')            // Replace spaces with hyphens
//         .replace(/[&]/g, 'and')          // Replace & with 'and'
//         .replace(/[^\w\-]/g, '')         // Remove special characters except word chars and hyphens
//         .replace(/--+/g, '-')            // Replace multiple hyphens with single
//         .replace(/^-+|-+$/g, '');        // Remove leading/trailing hyphens
// };

/**
 * Generates the complete meme editing URL
//  */
// export const generateMemeEditUrl = (baseUrl: string, memeName: string): string => {
//     const formattedName = formatMemeNameForUrl(memeName);
    
//     // Handle different URL patterns based on the base URL structure
//     if (baseUrl.includes('/memegenerator/')) {
//         return `${baseUrl}/${formattedName}`;
//     } else if (baseUrl.includes('/s/meme/')) {
//         return `${baseUrl}/${formattedName}.png`;
//     } else {
//         // Default pattern
//         return `${baseUrl}/${formattedName}`;
//     }
// };

/**
 * Test cases and examples
 */
export const testUrlFormatting = () => {
    const testCases = [
        'Distracted Boyfriend',
        'Buff Doge vs Cheems',
        'Drake hotline bling',
        'This is Fine',
        'Expanding Brain',
        'Epic Handshake',
        'Two Buttons',
        'Chill Guy'
    ];
    
    console.log('🧪 URL Formatting Test Results:');
    console.log('================================');
    
    testCases.forEach(memeName => {
        const formatted = formatMemeNameForUrl(memeName);
        const url1 = `https://imgflip.com/memegenerator/${formatted}`;
        const url2 = `https://imgflip.com/s/meme/${formatted}.png`;
        
        console.log(`Input: "${memeName}"`);
        console.log(`Formatted: "${formatted}"`);
        console.log(`URL 1: ${url1}`);
        console.log(`URL 2: ${url2}`);
        console.log('---');
    });
};

// // Example usage and patterns
// export const URL_PATTERNS = {
//     MEMEGENERATOR: (memeName: string) => 
//         `${MEME_URL}/${formatMemeNameForUrl(memeName)}`,
    
//     MEME_IMAGE: (memeName: string) => 
//         `https://imgflip.com/s/meme/${formatMemeNameForUrl(memeName)}.png`,
    
//     CUSTOM: (baseUrl: string, memeName: string) => 
//         generateMemeEditUrl(baseUrl, memeName)
// };