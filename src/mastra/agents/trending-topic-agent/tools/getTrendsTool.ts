import { createTool } from '@mastra/core';
import { chromium } from 'playwright';
import { z } from 'zod';

export const getTrendsTool = createTool({
    id: 'get-trends',
    description: 'Get the current trending topics from Twitter.',
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
        await page.goto('https://twitter.com/explore/tabs/trending');

        const trends = await page.evaluate(() => {
            const trendElements = Array.from(document.querySelectorAll('[data-testid="trend"]')).slice(0, 10);
            return trendElements.map(trend => {
                const name = trend.querySelector('div > div > span')?.textContent || '';
                const url = (trend.querySelector('a') as HTMLAnchorElement)?.href || '';
                return { name, url };
            });
        });

        await browser.close();
        return { trends };
    },
});