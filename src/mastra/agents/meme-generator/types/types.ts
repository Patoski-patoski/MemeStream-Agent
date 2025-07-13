//src/mastra/agents/meme-generator/types/types.ts
import { z } from 'zod';

export const MemeInputSchema = z.object({
  memeName: z.string().min(1).describe("The name of the meme to search for"),
});

export const MemePageLinkSchema = z.object({
  memePageFullUrl: z.string().url().describe(),
  memeBlankImgUrl: z.string().url().describe(),
});

// Represent a single scraped meme image
export const ScrapedMemeImageSchema = z.object({
  alt: z.string().describe(),
  src: z.string().url().describe(),
});

// This schema represents the array of scraped meme images, NOT a single image.
// This is used for the return type of scrapeMemeImagesFromPage if it only returns images.
export const ScrapedMemeImagesArraySchema = z.array(ScrapedMemeImageSchema);


// This is the combined final output for the workflow
export const FinalMemeOutputSchema = z.object({
  pageUrl: z.string().url().describe(),
  blankTemplateUrl: z.string().url().describe(),
  description: z.string().describe(),
  memeExamples: ScrapedMemeImagesArraySchema.describe(),
});


export type MemeInput = z.infer<typeof MemeInputSchema>;
export type MemeSearchResult = z.infer<typeof MemePageLinkSchema>;
export type MemeImageData = z.infer<typeof ScrapedMemeImageSchema>; // Represents a single image
export type FinalMemeData = z.infer<typeof FinalMemeOutputSchema>;