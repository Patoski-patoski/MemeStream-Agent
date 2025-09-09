// src/bot/types/types.ts

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


export type MemeSearchResult = z.infer<typeof MemePageLinkSchema>;
export type MemeImageData = z.infer<typeof ScrapedMemeImageSchema>; // Represents a single image

export interface MemeContext {
  memePageUrl: string;
  blankTemplateUrl: string;
  memeName: string;
  memeId?: string;
  currentPage: number;        // Tracks current page per chat
  lastRequestTime?: number;    // For rate limiting & cleanup
}


export interface ProgressTracker {
  chatId: number;
  messageId: number;
  currentStep: number;
  totalSteps: number;
  startTime: number;
  deletionScheduled?: boolean;
}

export interface ApiError {
  error: {
    code: number;
    message: string;
    status: string;
  };
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
  lastRequestTime: number;
}

export interface PopularMemesCache {
  memes: string[];
  timestamp: number;
}

export interface CacheStats {
  redis: {
    connected: boolean;
    memory?: string;
    error?: string;
  };
  contexts: {
    activeContexts: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
}

// === JOB QUEUE TYPES ===

// Data for a meme generation job
export interface MemeJobData {
  chatId: number;
  memeName: string;
  loadingMessageId: number;
  jobType: 'blank' | 'full';
  context?: MemeContext;
}

// Result of a meme generation job
export interface MemeJobResult {
  success: boolean;
  url?: string;
  error?: string;
}

// === IMGFLIP API TYPES ===

export interface ImgflipMeme {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  box_count: number;
  captions: number;
}

export interface ImgflipApiResponse {
  success: boolean;
  data: {
    memes: ImgflipMeme[];
  };
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

export interface CachedImgflipData {
  memes: ImgflipMeme[];
  timestamp: number;
}