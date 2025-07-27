// src/meme-generator/agents/memegeneratorAgent.ts

import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { chromium, Browser, Page } from 'playwright'; // Import Playwright components

import {
    searchMemeAndGetFirstLink,
    scrapeMemeImagesFromPage
} from '../tools/meme-generator-tools.js';

import {
    ContentPart,
    MemeSearchResult,
    MemeImageData
} from '../types/types.js';

import { tools } from "../utils/utils.js";
import { string } from "zod";

dotenv.config();

const modelName = process.env.MODEL_NAME!;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const toolFunctions: Record<string, Function> = {
    search_meme: searchMemeAndGetFirstLink,
    scrape_meme_images: scrapeMemeImagesFromPage
};

// Main function to run the agent
async function runMemeAgent(memeNameInput: string) {
    let browser: Browser | undefined; // Declare browser variable
    let page: Page | undefined; // Declare page variable

    try {
        browser = await chromium.launch(); // Launch a browser instance
        page = await browser.newPage(); // Open a new page

        // Initial conversation history
        let contents: { role: string, parts: ContentPart[] }[] = [
            {
                role: "system",
                parts: [
                    { text: "You are a helpful meme generator agent. Your task is to find a meme, extract its URL, and then scrape its associated images. Finally, present the found URL and images to the user. You have access to tools for searching and scraping." }
                ]
            },
            {
                role: "user",
                // Start with a general request, let the model decide to call search_meme
                parts: [{ text: `Please find the meme named "${memeNameInput}" and show me its main URL and associated images.` }]
            }
        ];

        let executionCount = 0; // Prevent infinite loops
        const MAX_EXECUTION_STEPS = 5; // Max steps for the agent to take

        while (executionCount < MAX_EXECUTION_STEPS) {
            executionCount++;
            console.log(`\n--- Agent Step ${executionCount} ---`);
            console.log("Current conversation history:", JSON.stringify(contents, null, 2));

            const result = await ai.models.generateContent({
                model: modelName,
                contents,
                config: { tools } // Pass the tools config
            });

            console.log("Model raw response:", JSON.stringify(result, null, 2));

            // Append model's response (text or functionCall) to history
            if (result.candidates
                && result.candidates[0]
                && result.candidates[0].content)
            {
                contents.push(result.candidates[0].content as { role: string; parts: ContentPart[]; });
                console.log("Appended model's content to history:", JSON.stringify(contents[contents.length - 1], null, 2));
            }

            if (result.functionCalls && result.functionCalls.length > 0) {
                const functionCall = result.functionCalls[0];
                console.log("Function call detected:", JSON.stringify(functionCall, null, 2));

                const { name, args } = functionCall;

                // Crucial check: Does the requested function exist in our toolFunctions map?
                if (typeof name !== "string" || !toolFunctions[name]) {
                    console.error(`Error: Model requested an unknown function call: ${name}. Stopping.`);
                    // Optionally, tell the model it called an unknown function
                    contents.push({
                        role: 'tool',
                        parts: [{ functionResponse: { name: name as string, response: { error: `Unknown tool: ${name}` } } }]
                    });
                    continue; // Continue loop to let model handle error or generate final text
                }

                console.log(`Executing tool: ${name} with args:`, args);

                // Pass the Playwright page object to the tool functions
                let toolResponse: MemeSearchResult | MemeImageData[] | any; // Use 'any' for general until specific structure is known
                if (args) {
                    if (name === "search_meme" && typeof args.memeName === "string") {
                        toolResponse = await toolFunctions[name](page, args.memeName);
                    } else if (name === "scrape_meme_images" && args.memePageUrl) {
                        toolResponse = await toolFunctions[name](page, args.memePageUrl);
                    } else {
                        console.error(`Handler not implemented for tool: ${name}`);
                        toolResponse = { error: `Handler not implemented for tool: ${name}` };
                    } 
                }

                console.log(`Tool response for ${name}:`, JSON.stringify(toolResponse, null, 2));

                const functionResponsePart: ContentPart = {
                    functionResponse: {
                        name: functionCall.name as string,
                        response: toolResponse,
                    }
                };

                // Append tool's response to history
                contents.push({ role: 'tool', parts: [functionResponsePart] });
                console.log("Appended tool's response to history:", JSON.stringify(contents[contents.length - 1], null, 2));

            } else {
                // No more function calls, print the final response and break the loop
                console.log("\n--- Final AI Response ---");
                console.log(result.text);
                break; // Exit the loop when no more function calls
            }

            if (executionCount >= MAX_EXECUTION_STEPS) {
                console.warn(`\nWarning: Agent reached maximum execution steps (${MAX_EXECUTION_STEPS}). Exiting loop.`);
                console.log("Last AI response:", result?.text || "No final text response.");
            }
        }
       

    } catch (error) {
        console.error("An error occurred during agent execution:", error);
    } finally {
        if (page) await page.close();
        if (browser) await browser.close(); // Close browser when done
    }
}

const memeToFind = "Distracted Boyfriend"; // Or "Chillguy" from your original
runMemeAgent(memeToFind);