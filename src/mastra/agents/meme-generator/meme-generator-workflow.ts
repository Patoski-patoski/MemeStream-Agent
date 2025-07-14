
import { Agent } from "@mastra/core/agent";
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { config } from 'dotenv';
import { chromium, Page, Browser } from 'playwright';


import {
    MemeInputSchema,
    FinalMemeOutputSchema,
    MemePageLinkSchema,
    MemeInput,
    MemeImageData
} from '../meme-generator/types/types';

import { createFullUrl } from '../meme-generator/utils/utils';
import { model } from '../../config';
import {
    searchMemeAndGetFirstLink,
    scrapeMemeImagesFromPage
} from '../meme-generator/tools/meme-generator-tools';

config();

const MEME_SEARCH_URL: string = process.env.MEME_URL;

const memeProvider = new Agent({
    name: "Meme Generator Agent",
    model,
    instructions: ` You are an expert on internet culture and memes.
        When given the name of a meme, your job is to provide a brief, engaging description.
        This can include its origin, history, how it's typically used, or some funny facts about it.
        Also, when asked to list meme templates, provide them clearly formatted.
    `
});

const getMemeUrl = createStep({
    id: "searchMemeAndGetFirstLink",
    description: "Fetches the meme URL based on the user's query",
    inputSchema: MemeInputSchema,
    outputSchema: MemePageLinkSchema,
    execute: async ({ inputData }: { inputData: MemeInput }) => {

        const browser: Browser = await chromium.launch({ headless: true});
        const page: Page = await browser.newPage();

        try {
            const searchResult = await searchMemeAndGetFirstLink(page, inputData.memeName);

            if (searchResult && searchResult.memePageFullUrl) {
                const memePageUrl = createFullUrl(searchResult.memePageFullUrl, MEME_SEARCH_URL);
                const memeBlankImgUrl = createFullUrl(searchResult.memeBlankImgUrl, MEME_SEARCH_URL);

                console.log("Meme page URL:", memePageUrl);
                console.log("Meme blank image URL:", memeBlankImgUrl);
            
                return {
                    memePageFullUrl: memePageUrl,
                    memeBlankImgUrl: memeBlankImgUrl,
                };
            } else {
                console.log("Could not get meme page link or blank image URL.");
                return {
                    memePageFullUrl: "",
                    memeBlankImgUrl:~ "",
                };
            }
        } catch (error) {
            console.error("An error occurred during meme search:", error);
            throw new Error("Failed to search for meme.", inputData.memeName);
        } finally {
            console.log("Closing the browser..........");
            await browser.close();
        }
    }
});

const fetchMemeTemplates = createStep({
    id: "scrapeMemeImagesFromPage",
    description: "Fetches meme templates and their details from the meme page.",
    inputSchema: MemePageLinkSchema,
    outputSchema: FinalMemeOutputSchema,
  
    execute: async ({ inputData }: { inputData: MemeImageData }) => {
        if (!inputData || !inputData.memePageFullUrl) {
            throw new Error("Input data not found or invalid meme page URL");
        }

        const browser: Browser = await chromium.launch({ headless: true });
        const page: Page = await browser.newPage();
        const memeBlankImgUrl = inputData.memeBlankImgUrl;
        const memePageFullUrl = inputData.memePageFullUrl;
        const splitted: string = memePageFullUrl.split("/");
        const memeName = splitted[splitted.length - 1];

        try {
            const scrapedImages = await scrapeMemeImagesFromPage(page, memePageFullUrl);

            // Format the scrapedImages for the LLM
            const formattedScrapedImages = scrapedImages
                .map(img => `Name: ${img.alt}, URL: ${img.src}`)
                .join('\n');

            const descriptionPrompt = `Provide a brief, engaging description for the meme from ${memeName}.
             This can include its origin, history, how it's typically used, or some funny facts about it.
             Also, suggest not less than 5 important/popular apps or websites users can use to
             create memes, always including ${MEME_SEARCH_URL}.`;
            
            const descriptionRes = await memeProvider.generate(descriptionPrompt);
            const description = descriptionRes?.text?.trim() || "No description available.";

            const memeListPrompt = `Given the following meme templates:\n${formattedScrapedImages}\n
             Beautifully arrange this list of available memes into Name and image pairs.
             After presenting the list, also ask the user if they need a blank template to 
             create their own customized version.`;


            const memeListRes = await memeProvider.generate(memeListPrompt);
            const listOfMemesText = memeListRes?.text?.trim() || "No meme examples available.";

            // Combine the description and the list of memes into the final description field
            const combinedDescription = `${description}\n\n${listOfMemesText}`;

            return {
                pageUrl: memePageFullUrl,
                blankTemplateUrl: memeBlankImgUrl,
                description: combinedDescription,
                memeExamples: scrapedImages,
            };
        } catch (error) {
            console.error("An error occurred during meme image scraping:", error);
            throw new Error("Failed to scrape meme images.");
        } finally {
            console.log("Closing the browser..........");
            await browser.close();
        }
    }

});

const memeGeneratorWorkflow = createWorkflow({
    id: 'memeGeneratorWorkflow',
    inputSchema: MemeInputSchema,
    outputSchema: FinalMemeOutputSchema, // Workflow output matches the final step's output
})
    .then(getMemeUrl)
    .then(fetchMemeTemplates);

memeGeneratorWorkflow.commit();

export { memeGeneratorWorkflow };
    