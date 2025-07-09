//src/mastra/agents/meme-generator/meme-generator.workflow.ts

import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { memeGeneratorAgent } from "./agents/meme-generator-agents";
import { MemeImageData, MemeInput } from "./types";

const getMemeTemplates = createStep({
  id: "get-meme-templates",
  description: "Fetches meme templates based on a user's query",
  inputSchema: z.object({
    memeName: z.string().describe("The name of the meme to search for"),
  }),
  outputSchema: z.object({
    memes: z.array(z.object({ 
        alt: z.string(),
        src: z.string(),
    })),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error("Input data not found");
    }

    const response = await memeGeneratorAgent.run(inputData as MemeInput);
    return {
      memes: response as MemeImageData[],
    };
  },
});

const memeGeneratorWorkflow = createWorkflow({
    id: "meme-generator-workflow",
    inputSchema: z.object({
        memeName: z.string().describe("The name of the meme to search for"),
    }),
    outputSchema: z.object({
        memes: z.array(z.object({ 
            alt: z.string(),
            src: z.string(),
        })),
    }),
})
.then(getMemeTemplates);

memeGeneratorWorkflow.commit();

export { memeGeneratorWorkflow };