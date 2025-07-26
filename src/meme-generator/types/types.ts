//src/mastra/agents/meme-generator/types/types.ts
import { z } from 'zod';

export const MemeInputSchema = z.object({
  memeName: z.string().min(1).describe("The name of the meme to search for"),
});

export const MemePageLinkSchema = z.object({
  memePageFullUrl: z.url(),
  memeBlankImgUrl: z.url(),
});

// Represent a single scraped meme image
export const ScrapedMemeImageSchema = z.object({
  alt: z.string(),
  src: z.url(),
});

// This is used for the return type of scrapeMemeImagesFromPage if it only returns images.
export const ScrapedMemeImagesArraySchema = z.array(ScrapedMemeImageSchema);


// This is the combined final output for the workflow
export const FinalMemeOutputSchema = z.object({
  pageUrl: z.url(),
  blankTemplateUrl: z.url(),
  description: z.string(),
  memeExamples: ScrapedMemeImagesArraySchema,
});

export type ContentPart = 
  | { text: string }
  | { functionCall: { name: string; args: Record<string, any> } }
  | { functionResponse: { name: string; response: Record<string, any> } };


export type MemeInput = z.infer<typeof MemeInputSchema>;
export type MemeSearchResult = z.infer<typeof MemePageLinkSchema>;
export type MemeImageData = z.infer<typeof ScrapedMemeImageSchema>; // Represents a single image
export type FinalMemeData = z.infer<typeof FinalMemeOutputSchema>;