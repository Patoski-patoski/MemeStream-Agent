import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';

// --- Mock instances ---
const mockRedisInstance = {
  on: jest.fn().mockReturnThis(),
  quit: jest.fn().mockResolvedValue(undefined as never),
  ping: jest.fn().mockResolvedValue('PONG' as never),
  status: 'ready',
};
const mockQueueInstance = {
  close: jest.fn().mockResolvedValue(undefined as never),
};

// --- Mock modules with factory ---
jest.mock('ioredis', () => {
  const Redis = jest.fn(() => mockRedisInstance);
  return { __esModule: true, default: Redis, Redis };
});
jest.mock('bullmq', () => {
  const Queue = jest.fn(() => mockQueueInstance);
  return { __esModule: true, Queue };
});

const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(undefined as never);
const consoleSpy = jest.spyOn(console, 'log').mockImplementation(undefined as never);
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(undefined as never);

describe('Queue Module', () => {
  const OLD_ENV = process.env;

  // Helper to get the common Redis options
  const getCommonRedisOptions = () => ({
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxLoadingTimeout: 60000,
    connectionName: 'memestream-queue',
    family: 4,
    keepAlive: 30000,
    commandTimeout: 30000,
    lazyConnect: true,
    db: 0,
  });

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    // Clear all Redis-related environment variables
    delete process.env.REDIS_URL;
    delete process.env.UPSTASH_REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
    delete process.env.REDIS_DB;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('should create Redis connection with Upstash URL', async () => {
    process.env.UPSTASH_REDIS_URL = 'redis://upstash-url';
    await import('../src/bot/core/queue');
    const { Redis } = await import('ioredis');
    
    expect(Redis).toHaveBeenCalledWith('redis://upstash-url', getCommonRedisOptions());
    expect(consoleSpy).toHaveBeenCalledWith('🌐 Using Upstash Redis connection');
  });

  it('should create Redis connection with REDIS_URL', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    await import('../src/bot/core/queue');
    const { Redis } = await import('ioredis');
    
    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', getCommonRedisOptions());
    expect(consoleSpy).toHaveBeenCalledWith('🔗 Using Redis URL connection');
  });

  it('should create Redis connection with individual config', async () => {
    process.env.REDIS_HOST = 'custom-host';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = 'secret';
    await import('../src/bot/core/queue');
    const { Redis } = await import('ioredis');
    
    expect(Redis).toHaveBeenCalledWith({
      ...getCommonRedisOptions(),
      host: 'custom-host',
      port: 6380,
      password: 'secret',
    });
  });

  it('should use default Redis config when no env vars are set', async () => {
    await import('../src/bot/core/queue');
    const { Redis } = await import('ioredis');
    
    expect(Redis).toHaveBeenCalledWith({
      ...getCommonRedisOptions(),
      host: 'localhost',
      port: 6379,
      password: undefined,
    });
    expect(consoleSpy).toHaveBeenCalledWith('⚙️ Using manual Redis configuration');
  });

  it('should respect custom REDIS_DB environment variable', async () => {
    process.env.REDIS_DB = '5';
    await import('../src/bot/core/queue');
    const { Redis } = await import('ioredis');
    
    expect(Redis).toHaveBeenCalledWith({
      ...getCommonRedisOptions(),
      db: 5,
      host: 'localhost',
      port: 6379,
      password: undefined,
    });
  });

  it('should handle Redis connection errors', async () => {
    let errorHandler: (error: Error) => void;
    mockRedisInstance.on.mockImplementation((...args: unknown[]) => {
      const [event, callback] = args as [string, (error: Error) => void];
      if (event === 'error') errorHandler = callback;
      return mockRedisInstance;
    });
    await import('../src/bot/core/queue');
    expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    
    const testError = new Error('BullMQ Redis connection error');
    errorHandler!(testError);
    expect(consoleErrorSpy).toHaveBeenCalledWith('❌ BullMQ Redis connection error:', expect.any(Error));
  });

  it('should register all Redis event handlers', async () => {
    await import('../src/bot/core/queue');
    
    expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockRedisInstance.on).toHaveBeenCalledWith('ready', expect.any(Function));
    expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockRedisInstance.on).toHaveBeenCalledWith('close', expect.any(Function));
    expect(mockRedisInstance.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
    expect(mockRedisInstance.on).toHaveBeenCalledWith('end', expect.any(Function));
  });

  it('should log on Redis connection ready', async () => {
    let readyHandler: () => void;
    mockRedisInstance.on.mockImplementation((...args: unknown[]) => {
      const [event, callback] = args as [string, () => void];
      if (event === 'ready') readyHandler = callback;
      return mockRedisInstance;
    });
    
    await import('../src/bot/core/queue');
    readyHandler!();
    
    expect(consoleSpy).toHaveBeenCalledWith('🚀 BullMQ Redis ready for operations');
  });

  it('should log on Redis connection close', async () => {
    let closeHandler: () => void;
    mockRedisInstance.on.mockImplementation((...args: unknown[]) => {
      const [event, callback] = args as [string, () => void];
      if (event === 'close') closeHandler = callback;
      return mockRedisInstance;
    });
    
    await import('../src/bot/core/queue');
    closeHandler!();
    
    expect(consoleWarnSpy).toHaveBeenCalledWith('⚠️ BullMQ Redis connection closed');
  });

  it('should log on Redis reconnecting', async () => {
    let reconnectingHandler: (delay: number) => void;
    mockRedisInstance.on.mockImplementation((...args: unknown[]) => {
      const [event, callback] = args as [string, (delay: number) => void];
      if (event === 'reconnecting') reconnectingHandler = callback;
      return mockRedisInstance;
    });
    
    await import('../src/bot/core/queue');
    reconnectingHandler!(1000);
    
    expect(consoleSpy).toHaveBeenCalledWith('🔄 BullMQ Redis reconnecting in 1000ms');
  });

  it('should create queue with correct configuration', async () => {
    await import('../src/bot/core/queue');
    const { Queue } = await import('bullmq');
    
    expect(Queue).toHaveBeenCalledWith('meme-generation', expect.objectContaining({
      connection: mockRedisInstance,
      defaultJobOptions: expect.objectContaining({
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 10,
        removeOnFail: { count: 100 },
      }),
    }));
  });

  it('should log successful initialization', async () => {
    await import('../src/bot/core/queue');
    expect(consoleSpy).toHaveBeenCalledWith('✅ BullMQ Queue initialized with monitoring');
  });

  it('should export memeQueue', async () => {
    const module = await import('../src/bot/core/queue');
    expect(module.memeQueue).toBeDefined();
    expect(module.memeQueue).toBe(mockQueueInstance);
  });

  it('should export queueMetrics', async () => {
    const module = await import('../src/bot/core/queue');
    expect(module.queueMetrics).toBeDefined();
    expect(module.queueMetrics).toEqual({
      jobsProcessed: 0,
      jobsFailed: 0,
      averageProcessingTime: 0,
      lastProcessedAt: null,
      errors: []
    });
  });

  describe('Rate Limiting', () => {
    it('should export checkRateLimit function', async () => {
      const module = await import('../src/bot/core/queue');
      expect(module.checkRateLimit).toBeDefined();
      expect(typeof module.checkRateLimit).toBe('function');
    });

    it('should allow first request within rate limit', async () => {
      const module = await import('../src/bot/core/queue');
      const result = module.checkRateLimit(12345);
      
      expect(result.allowed).toBe(true);
      expect(result.resetTime).toBeUndefined();
    });

    it('should track multiple requests from same user', async () => {
      const module = await import('../src/bot/core/queue');
      const chatId = 12345;
      
      // Make multiple requests
      for (let i = 0; i < 5; i++) {
        const result = module.checkRateLimit(chatId);
        expect(result.allowed).toBe(true);
      }
    });

    it('should block requests after rate limit exceeded', async () => {
      const module = await import('../src/bot/core/queue');
      const chatId = 12345;
      
      // Exhaust rate limit (10 requests)
      for (let i = 0; i < 10; i++) {
        module.checkRateLimit(chatId);
      }
      
      // Next request should be blocked
      const result = module.checkRateLimit(chatId);
      expect(result.allowed).toBe(false);
      expect(result.resetTime).toBeDefined();
    });

    it('should allow requests from different users independently', async () => {
      const module = await import('../src/bot/core/queue');
      
      const user1 = module.checkRateLimit(111);
      const user2 = module.checkRateLimit(222);
      
      expect(user1.allowed).toBe(true);
      expect(user2.allowed).toBe(true);
    });
  });

  describe('Job Management', () => {
    it('should export addMemeJob function', async () => {
      const module = await import('../src/bot/core/queue');
      expect(module.addMemeJob).toBeDefined();
      expect(typeof module.addMemeJob).toBe('function');
    });

    it('should export getQueueHealth function', async () => {
      const module = await import('../src/bot/core/queue');
      expect(module.getQueueHealth).toBeDefined();
      expect(typeof module.getQueueHealth).toBe('function');
    });
  });
});