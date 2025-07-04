import { Agent } from "@mastra/core/agent";
import { getTrendsTool } from '../tools/getTrendsTool';
import { getTopTweetsTool } from '../tools/getTopTweetsTool';
import { summarizeTopicTool } from '../tools/summarizeTopicTool';
import { generateTweetTool } from '../tools/generateTweetTool';
import { getTrendingTweetsTool } from '../tools/getTrendingTweetsTool';
import { model } from "../../../config";

const name = "Trending topic Summarizer Agent";

const instructions = `
      You are a helpful assistant that provides accurate information.
      Your primary function is to help users get accurate details for specific topics. When responding:
      - If the location name isn’t in English, please translate it
      - Keep responses concise but informative
      Use the getTrendingTweetsTool to fetch the top 10 tweets for a given trending topic.
`;

export const yourAgent = new Agent({
      name,
	instructions,
	model,
      tools: [
            getTrendsTool,
            getTopTweetsTool,
            summarizeTopicTool,
            generateTweetTool,
            getTrendingTweetsTool
      ],
});
