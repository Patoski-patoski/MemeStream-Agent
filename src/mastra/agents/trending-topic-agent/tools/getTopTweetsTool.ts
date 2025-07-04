import { createTool } from '@mastra/core';
import { chromium } from 'playwright';
import { z } from 'zod';

export const getTopTweetsTool = createTool({
    id: 'get-top-tweets',
    description: 'Get the top tweets for a given topic.',
    inputSchema: z.object({
        topic: z.string().describe('The topic to search for.'),
    }),
    outputSchema: z.object({
        tweets: z.array(z.object({
            text: z.string(),
            author: z.string(),
            url: z.string(),
        })),
    }),
    execute: async ({ context }) => {
        const browser = await chromium.launch();
        const page = await browser.newPage();
        await page.goto(`https://twitter.com/search?q=${encodeURIComponent(context.topic)}`);

        const tweets = await page.evaluate(() => {
            const tweetElements = Array.from(document.querySelectorAll('[data-testid="tweet"]')).slice(0, 10);
            return tweetElements.map(tweet => {
                const text = tweet.querySelector('[data-testid="tweetText"]')?.textContent || '';
                const author = tweet.querySelector('[data-testid="User-Name"]')?.textContent || '';
                const url = (tweet.querySelector('a[href*="/status/"]') as HTMLAnchorElement)?.href || '';
                return { text, author, url };
            });
        });

        await browser.close();
        return { tweets };
    },
});
