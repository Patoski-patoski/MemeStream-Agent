// types.ts
import { z } from 'zod';

export const MemeInputSchema = z.object({
  memeName: z.string().min(1).describe("The name of the meme to search for"),
});

export const MemeSearchResultSchema = z.object({
  memePageFullUrl: z.string().url(),
  memePreviewFullUrl: z.string().url(),
});

export const RawImageDataSchema = z.object({
  alt: z.string(),
  src: z.string().url(),
});

export const MemeImageDataSchema = z.object({
  alt: z.string(),
  src: z.string().url(),
});

export type MemeInput = z.infer<typeof MemeInputSchema>;
export type MemeSearchResult = z.infer<typeof MemeSearchResultSchema>;
export type RawImageData = z.infer<typeof RawImageDataSchema>;
export type MemeImageData = z.infer<typeof MemeImageDataSchema>;