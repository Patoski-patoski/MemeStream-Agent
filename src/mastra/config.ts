import dotenv from "dotenv";
import { createOllama } from "ollama-ai-provider";
import { createTool } from '@mastra/core/tools';
import { chromium } from 'playwright';
import { z } from 'zod';

dotenv.config();


// Export all your environment variables
// Defaults to Ollama qwen2.5:1.5b
// https://ollama.com/library/qwen2.5


export const modelName = process.env.MODEL_NAME_AT_ENDPOINT ?? "qwen2.5:1.5b";
export const baseURL = process.env.API_BASE_URL ?? "http://127.0.0.1:11434/api";

// Create and export the model instance
export const model = createOllama({ baseURL }).chat(modelName, {
    simulateStreaming: true,
});

console.log(`ModelName: ${modelName}\nbaseURL: ${baseURL}`);


const ConfigSchema = z.object({
    MEME_URL: z.string().url(),
});

function validateConfig() {
    const configData = {
        MEME_URL: process.env.MEME_URL,
    };

    const result = ConfigSchema.safeParse(configData);

    if (!result.success) {
        console.error("Configuration validation failed:", result.error.issues);
        process.exit(1);
    }

    return result.data;
}

export const appConfig = validateConfig();
