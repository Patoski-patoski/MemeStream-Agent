import { createTool } from '@mastra/core';
import { z } from 'zod';

export const summarizeTopicTool = createTool({
    id: 'summarize-topic',
    description: 'Summarize a given topic based on a list of tweets.',
    inputSchema: z.object({
        topic: z.string().describe('The topic to summarize.'),
        tweets: z.array(z.object({
            text: z.string(),
            author: z.string(),
            url: z.string(),
        })).describe('The list of tweets to summarize.'),
    }),
    outputSchema: z.object({
        summary: z.string(),
    }),
    execute: async ({ context }) => {
        // This is a placeholder for a real summarization implementation.
        // In a real-world scenario, you would use a language model to summarize the tweets.
        const summary = `This is a summary of the topic "${context.topic}".`;
        return { summary };
    },
});
