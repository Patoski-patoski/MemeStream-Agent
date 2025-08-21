import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { CachedMemeData, MemeContext } from '../src/bot/types/types';

// --- Define variables that will hold the mock implementations ---
let mockRedisInstance;
let mockRedisStore: Map<string, string>;
let mockGenerateContent: jest.Mock;

// --- Mock the modules at the top level of the file ---
jest.mock('ioredis', () => ({
    __esModule: true,
    // The Redis constructor will be a mock function that returns a mock instance
    Redis: jest.fn(() => mockRedisInstance),
}));

jest.mock('@google/genai', () => ({
    // The GoogleGenAI constructor will be a mock function that returns the mock AI object
    GoogleGenAI: jest.fn(() => ({
        models: {
            generateContent: mockGenerateContent,
        },
    })),
}));

describe('MemeCache Singleton', () => {
  let memeCache; // This will hold the fresh instance for each test

  beforeEach(async () => {
    // --- 1. Reset the state and variables used by the mocks ---
    mockRedisStore = new Map<string, string>();
    mockRedisInstance = {
        get: jest.fn((key: string) => Promise.resolve(mockRedisStore.get(key) || null)),
        setex: jest.fn((key: string, ttl: number, value: string) => {
            mockRedisStore.set(key, value);
            return Promise.resolve('OK');
        }),
        del: jest.fn((key: string) => {
            mockRedisStore.delete(key as string);
            return Promise.resolve(1);
        }),
        keys: jest.fn((pattern: string) => {
            const regex = new RegExp((pattern as string).replace('*', '.*'));
            const keys = Array.from(mockRedisStore.keys()).filter(key => regex.test(key));
            return Promise.resolve(keys);
        }),
        info: jest.fn(() => Promise.resolve('used_memory:1024')),
        quit: jest.fn(() => Promise.resolve('OK')),
        on: jest.fn(),
        status: 'ready',
    };
    mockGenerateContent = jest.fn();

    // --- 2. Reset module cache to force re-import ---
    jest.resetModules();

    // --- 3. Dynamically import the module to get a fresh instance ---
    // This instance will be created using the mocks we defined above.
    const cacheModule = await import('../src/bot/core/cache');
    memeCache = cacheModule.memeCache;
  });

  describe('Meme Data Caching', () => {
    it('should cache and retrieve meme data', async () => {
      const memeName = 'test-meme';
      const memeData: Partial<CachedMemeData> = {
        blankTemplateUrl: 'http://example.com/meme.jpg',
        memePageUrl: 'http://example.com/page',
      };

      await memeCache.cacheMeme(memeName, memeData);
      const cached = await memeCache.getCachedMeme(memeName);

      expect(cached).not.toBeNull();
      expect(cached?.blankTemplateUrl).toBe(memeData.blankTemplateUrl);
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        `meme:${memeName}`,
        10800, // 3 hours
        expect.any(String)
      );
    });

    it('should return null for a cache miss on meme data', async () => {
      const cached = await memeCache.getCachedMeme('non-existent-meme');
      expect(cached).toBeNull();
      expect(mockRedisInstance.get).toHaveBeenCalledWith('meme:non-existent-meme');
    });
  });

  describe('Blank Meme Caching', () => {
    it('should cache and retrieve a blank meme URL', async () => {
      const memeName = 'blank-meme';
      const memeUrl = 'http://example.com/blank.jpg';

      await memeCache.cacheBlankMeme(memeName, memeUrl);
      const cachedUrl = await memeCache.getBlankMeme(memeName);

      expect(cachedUrl).toBe(memeUrl);
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        `blank_meme:${memeName}`,
        604800, // 7 days
        memeUrl
      );
    });

    it('should return null for a cache miss on a blank meme', async () => {
        const cachedUrl = await memeCache.getBlankMeme('non-existent-blank-meme');
        expect(cachedUrl).toBeNull();
    });
  });

  describe('User Context Management', () => {
    const chatId = 12345;
    const context: Partial<MemeContext> = {
      memeName: 'test-meme',
      blankTemplateUrl: 'template1',
      lastRequestTime: 0, // will be updated
    };

    it('should set and get user context, updating TTL on get', async () => {
      await memeCache.setUserContext(chatId, context);
      const retrievedContext = await memeCache.getUserContext(chatId);

      expect(retrievedContext).toEqual(expect.objectContaining({ memeName: context.memeName }));
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        `user_context:${chatId}`,
        3600, // 30 minutes
        expect.any(String)
      );
      expect(mockRedisInstance.setex).toHaveBeenCalledTimes(2);
    });

    it('should delete user context', async () => {
        await memeCache.setUserContext(chatId, context);
        await memeCache.deleteUserContext(chatId);
        const retrievedContext = await memeCache.getUserContext(chatId);
  
        expect(retrievedContext).toBeNull();
        expect(mockRedisInstance.del).toHaveBeenCalledWith(`user_context:${chatId}`);
      });
  });

  describe('Popular Memes', () => {
    it('should return cached popular memes if available', async () => {
        const popularMemes = ['meme1', 'meme2'];
        const cacheData = { memes: popularMemes, timestamp: Date.now() };
        mockRedisStore.set('popular_memes', JSON.stringify(cacheData));
  
        const memes = await memeCache.getPopularMemes();
  
        expect(memes).toEqual(popularMemes);
        expect(mockGenerateContent).not.toHaveBeenCalled();
      });

      it('should generate, cache, and return popular memes if not cached', async () => {
        const generatedMemes = ['gen-meme1', 'gen-meme2', 'gen-meme3', 'gen-meme4', 'gen-meme5'];
        
        // MONKEY-PATCH: Directly overwrite the method on the instance
        memeCache.generatePopularMemes = jest.fn().mockResolvedValue(generatedMemes as never);

        const memes = await memeCache.getPopularMemes();
        
        // Check if the monkey-patched mock was called
        expect(memeCache.generatePopularMemes).toHaveBeenCalled();
        expect(memes).toEqual(generatedMemes);
        expect(mockRedisInstance.setex).toHaveBeenCalledWith(
          'popular_memes',
          3600,
          expect.any(String)
        );
      }, 10000);

      it('should use fallback memes if AI generation fails', async () => {
        mockGenerateContent.mockRejectedValue(new Error('AI failed') as never);
        const memes = await memeCache.getPopularMemes();
        expect(memes.length).toBe(5);
        expect(memes).toEqual(expect.any(Array));
        expect(mockRedisInstance.setex).toHaveBeenCalledWith(
            'popular_memes',
            3600,
            expect.any(String)
          );
      }, 20000);
  });

  describe('Cache Stats and Disconnect', () => {
    it('should get cache stats', async () => {
        mockRedisStore.set('user_context:1', '{}');
        mockRedisStore.set('user_context:2', '{}');
  
        const stats = await memeCache.getCacheStats();
  
        expect(stats.redis.connected).toBe(true);
        expect(stats.contexts.activeContexts).toBe(2);
        expect(mockRedisInstance.info).toHaveBeenCalledWith('memory');
        expect(mockRedisInstance.keys).toHaveBeenCalledWith('user_context:*');
      });

      it('should call quit on disconnect', async () => {
        await memeCache.disconnect();
        expect(mockRedisInstance.quit).toHaveBeenCalled();
      });
  });
});