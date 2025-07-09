// src/mastra/agents/meme-generator/run.ts

import { MemeScraperService } from './services/meme-scraper.service';

async function main(): Promise<void> {
    const scraperService = new MemeScraperService();

    try {
        await scraperService.initialize();

        const memeImages = await scraperService.scrapeMemesForQuery({
            memeName: "Drake Hotline Bling"
        });

        console.log(`Found ${memeImages.length} meme images`);
        memeImages.forEach((image, index) => {
            console.log(`${index + 1}. ${image.alt} - ${image.src}`);
        });

    } catch (error) {
        console.error("Application error:", error);
    } finally {
        await scraperService.cleanup();
    }
}

// Run the application
main().catch(console.error);