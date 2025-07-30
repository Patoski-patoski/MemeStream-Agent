// src/meme-generator/types/types.ts
import { z } from 'zod';

export const MemePageLinkSchema = z.object({
  memePageFullUrl: z.url(),
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

export interface MemeContext {
  memePageUrl: string;
  blankTemplateUrl: string;
  memeName: string;
  currentPage: number;        // Tracks current page per chat
  lastRequestTime: number;    // For rate limiting & cleanup
}

export interface ResponseHandler {
  sendUpdate: (message: string) => Promise<void>;
  sendImages: (images: MemeImageData[]) => Promise<void>;
}

export interface ProgressTracker {
  chatId: number;
  messageId: number;
  currentStep: number;
  totalSteps: number;
  startTime: number;
}