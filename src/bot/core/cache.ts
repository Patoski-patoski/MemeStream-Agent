// src/bot/core/cache.ts - Redis-Only Implementation
import { Redis } from 'ioredis';
import {
    MemeContext,
    CachedMemeData,
    PopularMemesCache
} from '../types/types.js';

class MemeCache {
    private redis: Redis;
    private readonly CACHE_TTL = 1 * 60 * 60; // 1 hour
    private readonly CONTEXT_TTL = 30 * 60; // 30 minutes for user contexts
    private readonly POPULAR_MEMES_TTL = 2 * 60 * 60; // 2 hours
    private readonly MEME_KEY_PREFIX = 'meme:';
    private readonly POPULAR_KEY = 'popular_memes';
    private readonly USER_CONTEXT_PREFIX = 'user_context:';

    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            // password: process.env.REDIS_PASSWORD,
            retryStrategy: (times) => {
                return Math.min(times * 100, 3000);
            },
            enableReadyCheck: false,
            lazyConnect: true,
            maxRetriesPerRequest: 3,
        });

        this.redis.on('error', (err) => {
            console.error('Redis connection error:', err);
        });

        this.redis.on('connect', () => {
            console.log('✅ Redis connected successfully');
        });
    }

    // === MEME DATA CACHING ===
    async getCachedMeme(memeName: string): Promise<CachedMemeData | null> {
        try {
            const key = this.MEME_KEY_PREFIX + memeName.toLowerCase().trim();
            const cached = await this.redis.get(key);

            if (cached) {
                const data = JSON.parse(cached) as CachedMemeData;
                console.log(`🎯 Cache HIT for "${memeName}"`);
                return data;
            }

            console.log(`⚡ Cache MISS for "${memeName}"`);
            return null;
        } catch (error) {
            console.error('Error getting cached meme:', error);
            return null;
        }
    }

    async cacheMeme(memeName: string, data: Omit<CachedMemeData, 'timestamp'>): Promise<void> {
        try {
            const key = this.MEME_KEY_PREFIX + memeName.toLowerCase().trim();
            const cacheData: CachedMemeData = {
                ...data,
                timestamp: Date.now()
            };

            await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(cacheData));
            console.log(`💾 Cached meme "${memeName}" for ${this.CACHE_TTL / 3600} hours`);
        } catch (error) {
            console.error('Error caching meme:', error);
        }
    }

    // === USER CONTEXT MANAGEMENT (Redis-only) ===
    async setUserContext(chatId: number, context: MemeContext): Promise<void> {
        try {
            const key = this.USER_CONTEXT_PREFIX + chatId;
            const contextData = {
                ...context,
                lastRequestTime: Date.now()
            };

            await this.redis.setex(key, this.CONTEXT_TTL, JSON.stringify(contextData));
            console.log(`💾 Cached user context for chat ${chatId}`);
        } catch (error) {
            console.error('Error setting user context:', error);
        }
    }

    async getUserContext(chatId: number): Promise<MemeContext | null> {
        try {
            const key = this.USER_CONTEXT_PREFIX + chatId;
            const cached = await this.redis.get(key);

            if (cached) {
                const context = JSON.parse(cached) as MemeContext;
                console.log(`🎯 Context HIT for chat ${chatId}`);

                // Update last access time
                await this.setUserContext(chatId, context);
                return context;
            }

            console.log(`⚡ Context MISS for chat ${chatId}`);
            return null;
        } catch (error) {
            console.error('Error getting user context:', error);
            return null;
        }
    }

    async deleteUserContext(chatId: number): Promise<void> {
        try {
            const key = this.USER_CONTEXT_PREFIX + chatId;
            await this.redis.del(key);
            console.log(`🗑️ Deleted context for chat ${chatId}`);
        } catch (error) {
            console.error('Error deleting user context:', error);
        }
    }

    // === POPULAR MEMES ===
    async getPopularMemes(): Promise<string[]> {
        try {
            const cached = await this.redis.get(this.POPULAR_KEY);

            if (cached) {
                const data = JSON.parse(cached) as PopularMemesCache;
                console.log('🎯 Using cached popular memes');
                return data.memes;
            }

            console.log('🤖 Generating new popular memes suggestions...');
            const popularMemes = await this.generatePopularMemes();

            const cacheData: PopularMemesCache = {
                memes: popularMemes,
                timestamp: Date.now()
            };

            await this.redis.setex(
                this.POPULAR_KEY,
                this.POPULAR_MEMES_TTL,
                JSON.stringify(cacheData)
            );

            return popularMemes;
        } catch (error) {
            console.error('Error getting popular memes:', error);
            return ['Drake hotline bling', 'Distracted Boyfriend', 'This is Fine', 'Expanding Brain', 'Two buttons'];
        }
    }

    private async generatePopularMemes(): Promise<string[]> {
        try {
            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

            const result = await ai.models.generateContent({
                model: process.env.MODEL_NAME!,
                contents: [{
                    role: "user",
                    parts: [{
                        text: `Provide exactly 5 random popular meme names that can be found on imgflip.com. 

Requirements:
- Must be actual popular internet memes
- Should be searchable on imgflip.com
- Return ONLY the meme names, one per line
- No numbering, bullets, or extra text
- Examples of format:
Drake hotline bling
Distracted Boyfriend
This is Fine
Expanding Brain
Two buttons

Give me 5 different popular memes:`
                    }]
                }],
                config: {
                    temperature: 0.8,
                    topP: 0.9,
                }
            });

            const responseText = result.text?.trim();
            if (responseText) {
                const memes = responseText
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .slice(0, 5);

                if (memes.length >= 3) {
                    console.log('✅ Generated popular memes:', memes);
                    return memes;
                }
            }

            throw new Error('AI response format invalid');

        } catch (error) {
            console.error('Error generating popular memes with AI:', error);

            const fallbackMemes = [
                'Drake hotline bling', 'Distracted Boyfriend', 'This is Fine', 'Expanding Brain',
                'Two buttons', 'Chill guy', 'Epic handshake', 'Woman yelling at cat',
                'Hide the pain Harold', 'Surprised Pikachu', 'Change my mind', 'One does not simply',
                'Ancient aliens', 'Success kid', 'Bad luck Brian', 'Good guy Greg',
                'Scumbag Steve', 'First world problems', 'Confession bear', 'Socially awkward penguin'
            ];

            const shuffled = fallbackMemes.sort(() => 0.5 - Math.random());
            return shuffled.slice(0, 5);
        }
    }

    // === STATISTICS ===
    async getCacheStats(): Promise<{ redis: any, contexts: any }> {
        try {
            const redisInfo = await this.redis.info('memory');

            // Get context count from Redis
            const contextKeys = await this.redis.keys(this.USER_CONTEXT_PREFIX + '*');

            return {
                redis: {
                    connected: this.redis.status === 'ready',
                    memory: redisInfo
                },
                contexts: {
                    activeContexts: contextKeys.length,
                    memoryUsage: process.memoryUsage()
                }
            };
        } catch (error: unknown) {
            if (error instanceof Error) {
                return {
                    redis: { connected: false, error: error.message },
                    contexts: {
                        activeContexts: 0,
                        memoryUsage: process.memoryUsage()
                    }
                };
            } else {
                return {
                    redis: { connected: false, error: 'Unknown error' },
                    contexts: {
                        activeContexts: 0,
                        memoryUsage: process.memoryUsage()
                    }
                };
            }
        }
    }

    // === CLEANUP (Redis handles TTL automatically) ===
    async cleanupExpiredEntries(): Promise<void> {
        try {
            // Redis automatically handles TTL, but we can manually clean if needed
            const contextKeys = await this.redis.keys(this.USER_CONTEXT_PREFIX + '*');
            console.log(`📊 Total active contexts in Redis: ${contextKeys.length}`);
        } catch (error) {
            console.error('Error checking Redis cleanup:', error);
        }
    }

    async disconnect(): Promise<void> {
        await this.redis.quit();
        console.log('🔌 Redis connection closed');
    }
}

export const memeCache = new MemeCache();