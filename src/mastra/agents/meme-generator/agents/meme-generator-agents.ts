import { Agent } from "@mastra/core/agent";
import { model } from "../../../config";
import { MemeScraperService } from "../services/meme-scraper.service";

const name = "Meme Generator Agent";
const instructions = `
You are a helpful assistant that generates memes. 

You can use the MemeScraperService to scrape memes from the internet. 

When asked to generate a meme, you should use the scrapeMemesForQuery tool to get a list of meme images. 

Then, you should present the user with a list of the available memes and ask them to choose one.
`;

const memeScraperService = new MemeScraperService();

export const memeGeneratorAgent = new Agent({
    name,
    instructions,
    model,
    tools: { 
        scrapeMemesForQuery: memeScraperService.scrapeMemesForQuery.bind(memeScraperService) 
    },
});