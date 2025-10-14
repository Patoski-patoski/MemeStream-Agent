// src/meme-generator/types/types.ts
import { z } from 'zod';
import { Page } from 'playwright';

export const MemePageLinkSchema = z.object({
  memePageFullUrl: z.url(),
  memeBlankImgUrl: z.url().nullable().optional(),
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
  | { functionCall: { name: string; args: Record<string, string | []> } }
  | { functionResponse: { name: string; response: Record<string, string | []> } };


export type MemeSearchResult = z.infer<typeof MemePageLinkSchema>;
export type MemeImageData = z.infer<typeof ScrapedMemeImageSchema>; // Represents a single image

export interface MemeContext {
  memePageUrl: string;
  blankTemplateUrl: string;
  memeName: string;
  memeId?: string;
  currentPage: number;        // Tracks current page per chat
  lastRequestTime: number;    // For rate limiting & cleanup
}

export interface ResponseHandler {
  sendUpdate: (message: string) => Promise<void>;
  sendImages: (images: MemeImageData[]) => Promise<void>;
}

export interface CachedMemeData {
  memePageUrl: string;
  blankTemplateUrl: string;
  memeName: string;
  images: MemeImageData[];
  originStory?: string;
  summary?: string;
  timestamp: number;
  currentPage: number;
}

export interface PopularMemesCache {
  memes: string[];
  timestamp: number;
}

export type MockPage = Omit<Page, '$eval' | '$$eval'> & {
  $eval: jest.Mock;
  $$eval: jest.Mock;
};

export type MemeToolFunction = (page: Page, memeName: string) => Promise<MemeSearchResult | MemeImageData[] | null>;

export interface BlankMemeTemplate {
  source: 'api' | 'scrape';
  id: string | null;
  name: string;
  url: string;
  pageUrl: string | null;
}

export interface ImgflipMeme {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  box_count: number;
  captions: number;
}