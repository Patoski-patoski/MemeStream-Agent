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

testUrlFormatting();
