// src/bot/core/cache.ts
import { Redis } from 'ioredis';
import {
    MemeContext,
    CachedMemeData,
    PopularMemesCache,
    CacheStats,
    ImgflipApiResponse,
    ImgflipMeme
} from '../types/types.js';

// const IMGFLIP_API_URL = 'https://api.imgflip.com/get_memes';

class MemeCache {
    private redis: Redis;
    private readonly CACHE_TTL = 12 * 60 * 60; // 12 hours
    private readonly CONTEXT_TTL = 12 * 60 * 60; // 12 hours for user contexts
    private readonly POPULAR_MEMES_TTL = 1 * 60 * 60; // 1 hour
    private readonly BLANK_MEMES_TTL =  7 * 24 * 60 * 60; // 1 week
    private readonly MEME_KEY_PREFIX = 'meme:';
    private readonly POPULAR_KEY = 'popular_memes';
    private readonly USER_CONTEXT_PREFIX = 'user_context:';


    /**
     * MemeCache constructor. Initializes a connection to a Redis server and
     * logs messages for connection events. It checks for environment variables
     * UPSTASH_REDIS_URL, REDIS_URL, and uses them or defaults to connect to
     * Redis. The connection is configured with error and other event handlers.
     */
    constructor() {
        // Check if we have an Upstash URL (production) or local Redis (development)
        const upstashUrl = process.env.UPSTASH_REDIS_URL;
        const localRedisUrl = process.env.REDIS_URL;

        if (upstashUrl) {
            console.log('🌐 Using Upstash Redis (Production)');
            this.redis = new Redis(upstashUrl, this.getUpstashConfig());
        } else if (localRedisUrl) {
            console.log('🏠 Using Redis URL (Development)');
            this.redis = new Redis(localRedisUrl, this.getLocalConfig());
        } else {
            console.log('💻 Using Local Redis (Development)');
            this.redis = new Redis(this.getLocalConfig());
        }

        this.redis.on('error', (err) => {
            console.error('❌ Redis connection error:', err.message.substring(12));
        });

        this.redis.on('connect', () => {
            console.log('✅ Redis connected successfully');
        });

        this.redis.on('ready', () => {
            console.log('🚀 Redis is ready to receive commands');
        });

        this.redis.on('close', () => {
            console.log('⚠️ Redis connection closed');
        });
    }

    /**
     * Configuration for connecting to Upstash Redis.
     * @returns {ioredis.RedisOptions} configuration object
     * @description
     * The configuration options used to connect to Upstash Redis are:
     * - retryStrategy: a function that takes the number of times a command has been retried
     *   and returns the delay in milliseconds to wait before retrying the command.
     *   The maximum delay is 3 seconds.
     * - enableReadyCheck: false, which means that the ready check is disabled.
     *   This is because Upstash Redis does not support the ready check.
     * - lazyConnect: true, which means that the connection is established lazily.
     *   This is useful in environments where the Redis server might not be available
     *   when the client is created.
     * - maxRetriesPerRequest: 3, which means that each command will be retried up to
     *   3 times in case of an error.
     * - connectTimeout: 10000, which is the time in milliseconds that the client
     *   waits for the connection to be established.
     * - lazyConnectTimeout: 10000, which is the time in milliseconds that the client
     *   waits before retrying to connect if the initial connection fails.
     */
    getUpstashConfig() {
        return {
            retryStrategy: (times: number) => Math.min(times * 100, 3000),
            enableReadyCheck: false,
            lazyConnect: true,
            maxRetriesPerRequest: 3,
            connectTimeout: 10000,
            lazyConnectTimeout: 10000,
        };
    }

    getLocalConfig() {
        return {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            retryStrategy: (times: number) => Math.min(times * 100, 3000),
            enableReadyCheck: false,
            lazyConnect: true,
            maxRetriesPerRequest: 3,
        };
    }

    // === IMGFLIP API CACHING ===
    async getMemesFromCacheOrApi(): Promise<ImgflipMeme[]> {
        const cacheKey = 'imgflip_api_memes';
        const cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

        try {
            // Try to get from cache first
            const cachedData = await this.redis.get(cacheKey);
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                const isExpired = Date.now() - parsed.timestamp > cacheExpiry;

                if (!isExpired) {
                    console.log(`⚡ Using cached ImgFlip API data (${parsed.memes.length} memes)`);
                    return parsed.memes;
                }
                console.log('🔄 Cached ImgFlip API data expired, fetching fresh data...');
            } else {
                console.log('🚀 No cached ImgFlip API data found, fetching for first time...');
            }

            // Fetch from API
            const response = await fetch('https://api.imgflip.com/get_memes');
            if (!response.ok) {
                throw new Error(`ImgFlip API responded with status: ${response.status}`);
            }

            const apiData: ImgflipApiResponse = await response.json();
            if (!apiData.success || !apiData.data?.memes) {
                throw new Error('Invalid response from ImgFlip API');
            }

            // Cache the fresh data
            const cacheData = {
                memes: apiData.data.memes,
                timestamp: Date.now()
            };

            await this.redis.setex(cacheKey, Math.floor(cacheExpiry / 1000), JSON.stringify(cacheData));
            console.log(`💾 Cached ${apiData.data.memes.length} memes from ImgFlip API`);

            return apiData.data.memes;

        } catch (error) {
            console.error('❌ Error fetching memes from API:', error);

            // Try to return stale cache data as fallback
            const cachedData = await this.redis.get(cacheKey);
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                console.log(`⚠️ Using stale cached data as fallback (${parsed.memes.length} memes)`);
                return parsed.memes;
            }

            // Return empty array if no cache available
            console.log('💥 No cached data available, returning empty array');
            return [];
        }
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


/**
 * Cache a meme's data in Redis with a specific time-to-live (TTL).
 * 
 * @param {string} memeName - The name of the meme to cache.
 * @param {Omit<CachedMemeData, 'timestamp'>} data - The data associated with the meme, excluding the timestamp.
 * @returns {Promise<void>} - A promise that resolves when the caching operation is complete.
 * 
 * Logs a message indicating the meme has been cached with the specified TTL duration.
 * In case of an error during caching, logs the error.
 */
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

    /**
     * Cache a blank meme's URL in Redis with a specific time-to-live (TTL).
     * 
     * @param {string} memeName - The name of the blank meme to cache.
     * @param {string} memeUrl - The URL of the blank meme image.
     * @returns {Promise<void>} - A promise that resolves when the caching operation is complete.
     * 
     * Logs a message indicating the blank meme has been cached with the specified TTL duration.
     * In case of an error during caching, logs the error.
     */
    async cacheBlankMeme(memeName: string, memeUrl: string): Promise<void> {
        try {
            const key = `blank_meme:${memeName.toLowerCase().trim()}`;
            await this.redis.setex(key, this.BLANK_MEMES_TTL, memeUrl);
            console.log(`💾 Cached blank meme "${memeName}" for 24 hours`);
        } catch (error) {
            console.error('Error caching blank meme:', error);
        }
    }

    /**
     * Retrieves a blank meme URL from Redis cache.
     * 
     * @param {string} memeName - The name of the blank meme to retrieve.
     * @returns {Promise<string | null>} - A promise resolving to the blank meme URL if found,
     *   or null if not found. If an error occurs during retrieval, logs the error and returns null.
     * 
     * Logs a message indicating cache hit or miss.
     */
    async getBlankMeme(memeName: string): Promise<string | null> {
        try {
            const key = `blank_meme:${memeName.toLowerCase().trim()}`;
            const cachedUrl = await this.redis.get(key);

            if (cachedUrl) {
                console.log(`🎯 Cache HIT for blank meme "${memeName}"`);
                return cachedUrl;
            }

            console.log(`⚡ Cache MISS for blank meme "${memeName}"`);
            return null;
        } catch (error) {
            console.error('Error getting blank meme:', error);
            return null;
        }
    }


    // === USER CONTEXT MANAGEMENT ===
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

    /**
     * Retrieves a user's context from Redis cache.
     * 
     * @param {number} chatId - The chat ID of the user to retrieve context for.
     * @returns {Promise<MemeContext | null>} - A promise resolving to the user context if found,
     *   or null if not found. If an error occurs during retrieval, logs the error and returns null.
     * 
     * Logs a message indicating cache hit or miss.
     * 
     * Also updates the last access time of the user context if found.
     */
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


/**
 * Deletes a user's context from Redis cache.
 * 
 * @param {number} chatId - The chat ID of the user whose context should be deleted.
 * @returns {Promise<void>} - A promise that resolves when the deletion is complete.
 * 
 * Logs a message indicating the context has been deleted. If an error occurs during deletion, logs the error.
 */

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

    /**
     * Generates an array of 5 popular meme names using the Google GenAI API.
     * 
     * If the AI response is invalid, falls back to a static list of popular memes.
     * 
     * @returns {Promise<string[]>} - A promise resolving to an array of 5 popular meme names.
     * 
     * Logs a message indicating the AI response is invalid if it fails to generate 5 valid meme names.
     * Logs a message indicating the fallback list is used if the AI response is invalid.
     */
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

    

    /**
     * Returns statistics about the current cache state.
     * @returns A Promise resolving to an object containing statistics about Redis and the context cache.
     * The object has the following shape:
     * 
     * {
     *   redis: {
     *     connected: boolean;
     *     memory: string;
     *   };
     *   contexts: {
     *     activeContexts: number;
     *     memoryUsage: NodeJS.MemoryUsage;
     *   };
     * }
     */
    async getCacheStats(): Promise<CacheStats> {
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

    /**
     * Closes the Redis connection and logs a message when successful.
     *
     * @returns {Promise<void>} - A promise that resolves when the connection is closed.
     */
    async disconnect(): Promise<void> {
        await this.redis.quit();
        console.log('🔌 Redis connection closed');
    }

  
    /**
     * Search for a meme in cached API data with fuzzy matching
     */
    async findMemeInCache(searchTerm: string): Promise<ImgflipMeme | null> {
        const allMemes = await this.getMemesFromCacheOrApi();
        searchTerm = this.capitalizeWords(searchTerm);
        const normalizedSearch = searchTerm.toLowerCase().trim();

        let bestMatch: ImgflipMeme | null = null;
        let highestScore = 0;

        const LEVENSHTEIN_THRESHOLD = 3; // Adjust as needed
        // console.log("All memes names: ", memeNames);

        for (const meme of allMemes) {
            const memeName = meme.name.toLowerCase();
            let currentScore = 0;

            // Strategy 1: Exact match (highest priority)
            if (memeName === normalizedSearch) {
                currentScore = 100; // Very high score for exact match
            }
            // Strategy 2: Partial match (contains or is contained by)
            else if (memeName.includes(normalizedSearch) || normalizedSearch.includes(memeName)) {
                // Score based on how much of the meme name is covered by the search term, or vice versa
                console.log(`Partial match found: "${memeName}" for "${normalizedSearch}"`);
                const coverage = Math.min(normalizedSearch.length, memeName.length) / Math.max(normalizedSearch.length, memeName.length);
                currentScore = 80 + (coverage * 10); // High score for partial match
            }
            // Strategy 3: Levenshtein distance matching
            else {
                const distance = this.levenshteinDistance(normalizedSearch, memeName);
                if (distance <= LEVENSHTEIN_THRESHOLD) {
                    // Score inversely proportional to distance, higher for shorter distances
                    console.log(`Levenshtein match found: "${memeName}" (distance: ${distance}) for "${normalizedSearch}"`);
                    currentScore = 70 - (distance * 5); // Score decreases with distance
                }
            }

            // Strategy 4: Fuzzy matching with individual words (lowest priority, but still important)
            if (currentScore < 70) { // Only apply if not already a strong match
                const searchWords = normalizedSearch.split(/\s+/).filter(word => word.length > 2);
                const memeWords = memeName.split(/\s+/).filter(word => word.length > 2); // Filter short words from meme name too

                if (searchWords.length > 0 && memeWords.length > 0) {
                    let matchedWordsInMeme = 0; // How many words from memeName are in searchWords
                    for (const mWord of memeWords) {
                        if (searchWords.some(sWord => sWord.includes(mWord) || mWord.includes(sWord))) {
                            matchedWordsInMeme++;
                        }
                    }

                    let matchedWordsInSearch = 0; // How many words from searchWords are in memeName
                    for (const sWord of searchWords) {
                        if (memeWords.some(mWord => mWord.includes(sWord) || sWord.includes(mWord))) {
                            matchedWordsInSearch++;
                        }
                    }

                    let wordMatchScore = 0;
                    if (matchedWordsInMeme > 0) {
                        // Score based on how many meme words are found in the search query
                        const memeWordCoverage = (matchedWordsInMeme / memeWords.length);
                        wordMatchScore = memeWordCoverage * 60; // Max 60 if all meme words are found
                    }

                    // Also consider how many search words are found in the meme name, but with less weight
                    if (matchedWordsInSearch > 0) {
                        const searchWordCoverage = (matchedWordsInSearch / searchWords.length);
                        wordMatchScore = Math.max(wordMatchScore, searchWordCoverage * 40); // Max 40
                    }

                    currentScore = Math.max(currentScore, wordMatchScore);
                }
            }

            if (currentScore > highestScore) {
                highestScore = currentScore;
                bestMatch = meme;
            }
        }

        if (bestMatch && highestScore > 0) {
            console.log(`✨ Best match found: "${bestMatch.name}" (score: ${highestScore}) for "${searchTerm}"`);
            return bestMatch;
        }

        console.log(`❌ No strong match found for "${searchTerm}" in ${allMemes.length} cached memes`);
        return null;
    }

    /**
     * Retrieve a cached meme's data by name.
     *
     * @param {string} memeName - The name of the meme to retrieve.
     * @returns {Promise<CachedMemeData | null>} - A promise that resolves with the cached meme's data if found, or null if not found.
     */
    async getMeme(memeName: string): Promise<CachedMemeData | null> {
        const key = this.MEME_KEY_PREFIX + memeName.toLowerCase().trim();
        const cached = await this.redis.get(key);
        if (cached) {
            console.log(`🎯 Cache HIT for meme "${memeName}"`);
            return JSON.parse(cached);
        }
        return null;
    }

    private capitalizeWords(str: string) {
        return str
            .split(' ') // Split the string into words
            .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
            .join(' '); // Join the words back into a single string
}


    /**
     * Computes the Levenshtein distance between two strings.
     *
     * @param {string} s1 - The first string.
     * @param {string} s2 - The second string.
     * @returns {number} - The Levenshtein distance between s1 and s2.
     *
     * The Levenshtein distance is a measure of the minimum number of single-character edits (insertions, deletions or substitutions) required to change one word into the other.
     *
     * This implementation is based on the Wagner-Fischer algorithm, with a time complexity of O(m*n), where m and n are the lengths of the strings.
     */
    private levenshteinDistance(s1: string, s2: string): number {
        s1 = this.capitalizeWords(s1);
        s2 = this.capitalizeWords(s2);

        const costs: number[] = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
            if (i > 0) {
                costs[s2.length] = lastValue;
            }
        }
        return costs[s2.length];
    }
}

export const memeCache = new MemeCache();
