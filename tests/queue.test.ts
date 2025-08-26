import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';

// --- Mock instances ---
const mockRedisInstance = {
  on: jest.fn().mockReturnThis(),
  quit: jest.fn().mockResolvedValue(undefined as never),
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

describe('Queue Module', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    // Clear all Redis-related environment variables to ensure a clean slate for each test
    delete process.env.REDIS_URL;
    delete process.env.UPSTASH_REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('should create Redis connection with Upstash URL', async () => {
    process.env.UPSTASH_REDIS_URL = 'redis://upstash-url';
    await import('../dist/bot/core/queue.js');
    const { Redis } = await import('ioredis');
    expect(Redis).toHaveBeenCalledWith('redis://upstash-url', { maxRetriesPerRequest: null });
  });

  it('should create Redis connection with REDIS_URL', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    await import('../dist/bot/core/queue.js');
    const { Redis } = await import('ioredis');
    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', { maxRetriesPerRequest: null });
  });

  it('should create Redis connection with individual config', async () => {
    process.env.REDIS_HOST = 'custom-host';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = 'secret';
    await import('../dist/bot/core/queue.js');
    const { Redis } = await import('ioredis');
    expect(Redis).toHaveBeenCalledWith({
      host: 'custom-host',
      port: 6380,
      password: 'secret',
      maxRetriesPerRequest: null,
    });
  });

  it('should use default Redis config when no env vars are set', async () => {
    await import('../dist/bot/core/queue.js');
    const { Redis } = await import('ioredis');
    expect(Redis).toHaveBeenCalledWith({
      host: 'localhost',
      port: 6379,
      password: undefined,
      maxRetriesPerRequest: null,
    });
  });

  it('should handle Redis connection errors', async () => {
    let errorHandler: (error: Error) => void;
    mockRedisInstance.on.mockImplementation((...args: unknown[]) => {
      const [event, callback] = args as [string, (error: Error) => void];
      if (event === 'error') errorHandler = callback;
      return mockRedisInstance;
    });
    await import('../dist/bot/core/queue.js');
    expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    const testError = new Error('fail');
    errorHandler!(testError);
    expect(consoleErrorSpy).toHaveBeenCalledWith('❌ BullMQ Redis connection error:', testError);
  });

  it('should create queue with correct configuration', async () => {
    await import('../dist/bot/core/queue.js');
    const { Queue } = await import('bullmq');
    expect(Queue).toHaveBeenCalledWith('meme-generation', expect.objectContaining({
      connection: mockRedisInstance,
      defaultJobOptions: expect.any(Object),
    }));
  });

  it('should log successful initialization', async () => {
    await import('../dist/bot/core/queue.js');
    expect(consoleSpy).toHaveBeenCalledWith('✅ BullMQ Queue initialized');
  });

  it('should export memeQueue', async () => {
    const module = await import('../dist/bot/core/queue.js');
    expect(module.memeQueue).toBeDefined();
    expect(module.memeQueue).toBe(mockQueueInstance);
  });
});