import { createTool } from '@mastra/core';
import { z } from 'zod';

export const generateTweetTool = createTool({
    id: 'generate-tweet',
    description: 'Generate a tweet about a given topic.',
    inputSchema: z.object({
        topic: z.string().describe('The topic to generate a tweet about.'),
        summary: z.string().describe('The summary of the topic.'),
    }),
    outputSchema: z.object({
        tweet: z.string(),
    }),
    execute: async ({ context }) => {
        // This is a placeholder for a real tweet generation implementation.
        // In a real-world scenario, you would use a language model to generate a tweet.
        const tweet = `Here is a tweet about "${context.topic}": ${context.summary}`;
        return { tweet };
    },
});
