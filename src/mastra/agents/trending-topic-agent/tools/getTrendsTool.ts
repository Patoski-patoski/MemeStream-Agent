import { createTool } from '@mastra/core';
import { chromium } from 'playwright';
import { z } from 'zod';

export const getTrendingTweetsTool = createTool({
    id: 'get-trends',
    description: 'Scrape the top 10 trending topics from X.',
    inputSchema: z.object({}),
    outputSchema: z.object({
        trends: z.array(z.object({
            name: z.string(),
            url: z.string(),
        })),
    }),
    execute: async () => {
        const browser = await chromium.launch();
        const page = await browser.newPage();
        await page.goto('https://x.com/explore/tabs/trending');

        const trends = await page.evaluate(() => {
            const trendElements = Array.from(document.querySelectorAll('div[aria-labelledby^="accessible-list"] > div > div'));
            return trendElements.slice(0, 10).map(trend => {
                const nameElement = trend.querySelector('a > div > div > span');
                const name = nameElement ? (nameElement as HTMLElement).innerText : '';
                const url = trend.querySelector('a') ? (trend.querySelector('a') as HTMLAnchorElement).href : '';
                return { name, url };
            });
        });

        await browser.close();
        console.log("trends", trends);
        return { trends };
    },
});