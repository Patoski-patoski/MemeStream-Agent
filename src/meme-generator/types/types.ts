// src/meme-generator/types/types.ts
import { z } from 'zod';

// Updated to allow memeBlankImgUrl to be nullable in schema
export const MemePageLinkSchema = z.object({
  memePageFullUrl: z.url(), // Using string().url() for stricter URL validation
  memeBlankImgUrl: z.url().nullable().optional(), // Make optional and nullable if it can be missing
});

// Represent a single scraped meme image
export const ScrapedMemeImageSchema = z.object({
  alt: z.string(),
  src: z.url(),
});

// This is used for the return type of scrapeMemeImagesFromPage if it only returns images.
export const ScrapedMemeImagesArraySchema = z.array(ScrapedMemeImageSchema);


export type ContentPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, any> } }
  | { functionResponse: { name: string; response: Record<string, any> } };


export type MemeSearchResult = z.infer<typeof MemePageLinkSchema>;
export type MemeImageData = z.infer<typeof ScrapedMemeImageSchema>; // Represents a single image