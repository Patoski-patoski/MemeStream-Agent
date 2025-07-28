// src/meme-generator/agents/memegeneratorAgent.ts

import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { chromium, Browser, Page } from 'playwright';

import {
    searchMemeAndGetFirstLink,
    scrapeMemeImagesFromPage
} from '../tools/meme-generator-tools.js';

import {
    ContentPart,
    MemeSearchResult,
    MemeImageData
} from '../types/types.js';

import { tools } from "../utils/utils.js"; // This holds your tool definitions

dotenv.config();

const modelName = process.env.MODEL_NAME!;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const toolFunctions: Record<string, Function> = {
    search_meme: searchMemeAndGetFirstLink,
    scrape_meme_images: scrapeMemeImagesFromPage
};

interface ResponseHandler {
    sendUpdate: (message: string) => Promise<void>;
    sendImages: (images: MemeImageData[]) => Promise<void>;
}

// Main function to run the agent
export async function runMemeAgent(
    memeNameInput: string,
    responseHandler?: ResponseHandler
) {
    let browser: Browser | undefined;
    let page: Page | undefined;

    try {
        browser = await chromium.launch();
        page = await browser.newPage();

        // Initial conversation history to prompt the model for the first tool call
        let contents: { role: string, parts: ContentPart[] }[] = [
            {
                role: "user",
                parts: [
                    { text: "You are a helpful meme generator agent. Your primary task is to find a meme, extract its URL, and then scrape its associated images. Once complete, you will present the found URL and images to the user in a concise, well-formatted summary. You have access to tools for searching and scraping." }
                ]
            },
            {
                role: "user",
                parts: [{ text: `Please find the meme named "${memeNameInput}" and show me its main URL and associated images.` }]
            }
        ];

        // --- Agent Step 1: Model decides to search for the meme ---
        console.log(`\n--- Agent Step 1: Model deciding to search for "${memeNameInput}" ---`);
        const resultStep1 = await ai.models.generateContent({
            model: modelName,
            contents,
            config: { tools }
        });

        // Append model's response (expected to be functionCall for search_meme)
        if (resultStep1.candidates && resultStep1.candidates[0] && resultStep1.candidates[0].content) {
            contents.push(resultStep1.candidates[0].content as { role: string; parts: ContentPart[]; });
            console.log("Appended model's content to history:", JSON.stringify(contents[contents.length - 1], null, 2));
        } else {
            console.error("Agent failed to initiate search. No candidate content from initial model call.");
            return;
        }

        const functionCallStep1 = resultStep1.functionCalls?.[0];

        if (!functionCallStep1 || functionCallStep1.name !== "search_meme") {
            console.error("Expected 'search_meme' function call in Step 1, but got:", functionCallStep1);
            console.log("Model's text response:", resultStep1.text); // Print any text response it might have given
            return;
        }

        console.log(`\n--- Agent Step 2: Executing search_meme tool ---`);
        console.log("Function call detected:", JSON.stringify(functionCallStep1, null, 2));

        // Execute the search_meme tool
        const memeSearchResult = await toolFunctions[functionCallStep1.name](page, functionCallStep1.args!.memeName) as MemeSearchResult;
        console.log(`Tool response for ${functionCallStep1.name}:`, JSON.stringify(memeSearchResult, null, 2));

        // Append search_meme tool's response to history
        contents.push({
            role: 'tool',
            parts: [{ functionResponse: { name: functionCallStep1.name, response: memeSearchResult } }]
        });
        console.log("Appended tool's response to history:", JSON.stringify(contents[contents.length - 1], null, 2));

        if (!memeSearchResult || !memeSearchResult.memePageFullUrl) {
            console.log(`Could not find a meme page for "${memeNameInput}".`);
            // Add a final user prompt to tell the model to respond about not finding the meme
            contents.push({
                role: 'user',
                parts: [{ text: `I could not find a meme page for "${memeNameInput}". Please inform the user.` }]
            });
            const finalResult = await ai.models.generateContent({
                model: modelName,
                contents,
            });
            console.log("\n--- Final AI Response ---");
            console.log(finalResult.text);
            return;
        }

        // --- Agent Step 3: Model decides to scrape images ---
        // This step is crucial to get the model to explicitly call `scrape_meme_images`
        console.log(`\n--- Agent Step 3: Model deciding to scrape images for "${memeNameInput}" ---`);
        const resultStep3 = await ai.models.generateContent({
            model: modelName,
            contents,
            config: { tools }
        });

        // Append model's response (expected to be functionCall for scrape_meme_images)
        if (resultStep3.candidates && resultStep3.candidates[0] && resultStep3.candidates[0].content) {
            contents.push(resultStep3.candidates[0].content as { role: string; parts: ContentPart[]; });
            console.log("Appended model's content to history:", JSON.stringify(contents[contents.length - 1], null, 2));
        } else {
            console.error("Agent failed to get scrape image instruction from model. No candidate content from model call.");
            return;
        }

        const functionCallStep3 = resultStep3.functionCalls?.[0];

        if (!functionCallStep3 || functionCallStep3.name !== "scrape_meme_images") {
            console.error("Expected 'scrape_meme_images' function call in Step 3, but got:", functionCallStep3);
            console.log("Model's text response:", resultStep3.text);
            return;
        }

        // --- Agent Step 4: Triggering scrape_meme_images concurrently with streaming origin ---
        console.log(`\n--- Agent Step 4: Executing scrape_meme_images tool and streaming origin story ---`);
        console.log("Function call detected:", JSON.stringify(functionCallStep3, null, 2));


        // Start the meme origin story stream immediately
        const originStreamPromise = (async () => {
            const originContents: { role: string; parts: ContentPart[] }[] = [
                {
                    role: "user",
                    parts: [{
                        text: `You are a helpful assistant specialized in meme history.
                        When asked about a meme, provide its origin story, how it's typically
                        used, and how it became popular. Keep it concise but informative.`
                    }]
                },
                {
                    role: "user",
                    parts: [{ text: `Tell me about the origin of the "${memeNameInput}" meme.` }]
                }
            ];

            const streamResult = await ai.models.generateContentStream({
                model: modelName,
                contents: originContents,
                // Do NOT pass tools config for this stream
            });

            console.log("\n--- Meme Origin Story (Streaming) ---");
            let streamedText = "";
            for await (const chunk of streamResult) {
                const textChunk = chunk.text;
                if (textChunk) {
                    process.stdout.write(textChunk);
                    streamedText += textChunk;
                }
            }
            console.log("\n--- End of Origin Story ---");
            return streamedText;
        })();

        // Execute the scrape_meme_images tool
        const scrapedImagesPromise = (async () => {
            const scrapedImages = await toolFunctions.scrape_meme_images(page, memeSearchResult.memePageFullUrl) as MemeImageData[];
            return { images: scrapedImages }; // Wrap array in object
        })();

        // Wait for both the streaming text to finish AND the scraping to complete
        const [fullOriginStory, scrapedImagesResult] = await Promise.all([
            originStreamPromise,
            scrapedImagesPromise
        ]);

        console.log(`Tool response for scrape_meme_images:`, JSON.stringify(scrapedImagesResult, null, 2));

        // Append scrape_meme_images tool's response to history
        contents.push({
            role: 'tool',
            parts: [{ functionResponse: { name: functionCallStep3.name, response: scrapedImagesResult } }]
        });
        console.log("Appended tool's response to history:", JSON.stringify(contents[contents.length - 1], null, 2));


        // --- Agent Step 5: Generating Final Response ---
        console.log(`\n--- Agent Step 5: Generating Final User-Facing Response ---`);

        // Add a final user prompt to guide the model to summarize and present
        contents.push({
            role: 'user',
            parts: [{
                text: `I have completed searching for the meme and scraping its images. 
                The blank meme page URL is ${memeSearchResult.memeBlankImgUrl}. 
                Please provide a clear and concise summary of the meme, including its blank meme URL, 
                main page URL ${memeSearchResult.memePageFullUrl}, and a well-formatted list of 
                the URLs for the scraped images. Present the images as a bulleted list, with each item showing
                the 'alt' text and the 'src' URL, e.g., "- Alt Text: [image-url-here.jpg]".`
            }]
        });

        // Generate the final comprehensive response
        const finalResult = await ai.models.generateContent({
            model: modelName,
            contents,
            // Tools are not strictly necessary here, but keeping it doesn't harm
            config: { tools }
        });

        console.log("\n--- Final AI Response ---");
        console.log(finalResult.text);

        // If we have a response handler, send the updates through it
        if (responseHandler) {
            // Send the final summary
            await responseHandler.sendUpdate(finalResult.text as string);

            // Send the scraped images if available
            if (scrapedImagesResult?.images?.length > 0) {
                await responseHandler.sendImages(scrapedImagesResult.images);
            }
        }

        return {
            summary: finalResult.text,
            images: scrapedImagesResult?.images || [],
            memePageUrl: memeSearchResult.memePageFullUrl,
            blankMemeUrl: memeSearchResult.memeBlankImgUrl
        };

    } catch (error) {
        console.error("An error occurred during agent execution:", error);
    } finally {
        console.log("Reached here!!!!");
        if (page) await page.close();
        if (browser) await browser.close();
    }
}

// const memeToFind = "Distracted Boyfriend";
// runMemeAgent(memeToFind);