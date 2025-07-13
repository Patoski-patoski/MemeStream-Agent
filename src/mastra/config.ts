//src/mastra/config.ts

import dotenv from "dotenv";
import { createOllama } from "ollama-ai-provider";
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

model.supportsImageUrls = true,

console.log("Model", model);
console.log(`ModelName: ${modelName}\nbaseURL: ${baseURL}`);


