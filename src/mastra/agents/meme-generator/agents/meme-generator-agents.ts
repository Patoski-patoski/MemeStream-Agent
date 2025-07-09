// src/mastra/agents/meme-generator/agents/meme-generator-agents.ts

import { Agent } from "@mastra/core/agent";
import { model } from "../../../config";
import { memeSearchTool } from "../tools/meme-generator-tools";

const name = "Meme Generator Agent";
const instructions = `
You are a helpful assistant that generates memes. 

You can use the memeSearchTool to find meme templates online.

When a user asks for a meme, use the memeSearchTool with their query to get a list of relevant meme images. 

Present the user with a list of the available memes and ask them to choose one.
`;

export const memeGeneratorAgent = new Agent({
    name,
    instructions,
    model,
    tools: { 
        memeSearchTool
    },
});