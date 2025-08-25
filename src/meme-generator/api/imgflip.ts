// src/meme-generator/api/imgflip.ts
import { ImgflipMeme } from '../../bot/types/types.js';
import { memeCache } from '../../bot/core/cache.js';

/**
 * Fetches the list of memes from the ImgFlip API and searches for a specific meme.
 * @param memeName The name of the meme to search for.
 *
 * @returns A promise that resolves to the meme object if found, otherwise null.
 */
export const getMemeFromImgFlip = async (memeName: string): Promise<ImgflipMeme | null> => {
  try {
    console.log(`Searching for meme: "${memeName}"`);
    const memes = await memeCache.getMemesFromCacheOrApi();

    const lowerCaseMemeName = memeName.toLowerCase();
    const meme = memes.find(m => m.name.toLowerCase().includes(lowerCaseMemeName));
    console.log("meme", meme);


    return meme || null;
  } catch (error) {
    console.error('Error fetching from ImgFlip API:', error);
    return null;
  }
};