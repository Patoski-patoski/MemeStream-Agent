// //src/mastra/config.ts

import dotenv from "dotenv";
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// import { createOllama } from "ollama-ai-provider";
// import { z } from 'zod';

dotenv.config();


export const modelName = process.env.MODEL_NAME_AT_ENDPOINT!;
export const baseURL = process.env.API_BASE_URL;
export const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

// Create and export the model instance
export const model = createGoogleGenerativeAI({ baseURL }).chat(modelName, {
    simulateStreaming: true,
});


model.supportsImageUrls = true;
console.log("Model", model); 
console.log(`ModelName: ${modelName}\nbaseURL: ${baseURL}`);

