// tests/imgflip.test.ts
import { jest, describe, it, expect, afterEach } from '@jest/globals';
import { getMemeFromImgFlip } from '../src/meme-generator/api/imgflip';
import { memeCache } from '../src/bot/core/cache';
import { ImgflipMeme } from '../src/bot/types/types';

describe('getMemeFromImgFlip', () => {
  const mockMemes: ImgflipMeme[] = [
    { id: '1', name: 'Drake Hotline Bling', url: 'url1', width: 100, height: 100, box_count: 2, captions: 3 },
    { id: '2', name: 'Distracted Boyfriend', url: 'url2', width: 100, height: 100, box_count: 2, captions: 2 },
    { id: '3', name: 'Two Buttons', url: 'url3', width: 100, height: 100, box_count: 2, captions: 2 },
  ];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return a meme if found in the cache', async () => {
    jest.spyOn(memeCache, 'getMemesFromCacheOrApi').mockResolvedValue(mockMemes);
    const meme = await getMemeFromImgFlip('Distracted Boyfriend');
    expect(meme).toEqual(mockMemes[1]);
    expect(memeCache.getMemesFromCacheOrApi).toHaveBeenCalledTimes(1);
  });

  it('should return a meme if found with case-insensitive search', async () => {
    jest.spyOn(memeCache, 'getMemesFromCacheOrApi').mockResolvedValue(mockMemes);
    const meme = await getMemeFromImgFlip('drake hotline bling');
    expect(meme).toEqual(mockMemes[0]);
    expect(memeCache.getMemesFromCacheOrApi).toHaveBeenCalledTimes(1);
  });

  it('should return null if meme is not found', async () => {
    jest.spyOn(memeCache, 'getMemesFromCacheOrApi').mockResolvedValue(mockMemes);
    const meme = await getMemeFromImgFlip('Non Existent Meme');
    expect(meme).toBeNull();
    expect(memeCache.getMemesFromCacheOrApi).toHaveBeenCalledTimes(1);
  });

  it('should return null and log an error if getMemesFromCacheOrApi throws an error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const errorMessage = 'API is down';
    jest.spyOn(memeCache, 'getMemesFromCacheOrApi').mockRejectedValue(new Error(errorMessage));
    const meme = await getMemeFromImgFlip('any meme');
    expect(meme).toBeNull();
    expect(memeCache.getMemesFromCacheOrApi).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching from ImgFlip API:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });
});
