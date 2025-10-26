// tests/memeFinderAgent.test.ts

import { jest } from '@jest/globals';

// 1. Create mock functions FIRST
const mockGenerateContent = jest.fn<() => Promise<{ text: string }>>();
const mockGetMemesFromCacheOrApi = jest.fn<() => Promise<Array<{ id: string; name: string; captions: number }>>>();
const mockFindMemeInCache = jest.fn<(query: string) => Promise<{ id: string; name: string; captions: number } | null>>();
const mockIsRetryableError = jest.fn<() => boolean>();
const mockCalculateDelay = jest.fn<() => number>();

// 2. Mock ALL modules BEFORE any imports
jest.unstable_mockModule('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

jest.unstable_mockModule('../src/bot/core/cache.js', () => ({
  memeCache: {
    getMemesFromCacheOrApi: mockGetMemesFromCacheOrApi,
    findMemeInCache: mockFindMemeInCache,
  },
}));

jest.unstable_mockModule('../src/meme-generator/utils/utils.js', () => ({
  isRetryableError: mockIsRetryableError,
  calculateDelay: mockCalculateDelay,
}));

// Mock environment variables
process.env.MODEL_NAME = 'gemini-test-model';
process.env.GEMINI_API_KEY = 'test-api-key';

// 3. NOW import the module under test (this must happen AFTER mocking)
const { findMemeByDescription } = await import('../src/meme-generator/agents/memeFinderAgent.js');

const mockMemes = [
  { id: '1', name: 'Drake Hotline Bling', captions: 100000 },
  { id: '2', name: 'Distracted Boyfriend', captions: 90000 },
  { id: '3', name: 'Two Buttons', captions: 80000 },
  { id: '4', name: 'Spider-Man Pointing', captions: 70000 },
];

describe('findMemeByDescription', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Set up default behavior
    mockGetMemesFromCacheOrApi.mockResolvedValue(mockMemes);
    mockFindMemeInCache.mockImplementation(async (query: string) =>
      mockMemes.find(m => m.name.toLowerCase().includes(query.toLowerCase())) || null
    );

    // Default retry logic behavior
    mockIsRetryableError.mockReturnValue(false);
    mockCalculateDelay.mockReturnValue(1000);
  });

  it('should find a meme by direct description match', async () => {
    const result = await findMemeByDescription(123, 'drake hotline bling');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Drake Hotline Bling');
    expect(mockGetMemesFromCacheOrApi).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('should use AI keyword extraction when direct search fails', async () => {
    // Return memes that don't match the search term
    const nonMatchingMemes = [
      { id: '5', name: 'Grumpy Cat', captions: 50000 },
      { id: '6', name: 'Success Kid', captions: 40000 },
    ];
    mockGetMemesFromCacheOrApi.mockResolvedValue(nonMatchingMemes as never);

    // Mock AI to return keywords
    mockGenerateContent.mockResolvedValue({
      text: 'drake, approval, hotline'
    });

    // Mock findMemeInCache to return the Drake meme only for the keyword 'drake'
    mockFindMemeInCache.mockImplementation(async (query: string) => {
      if (query.toLowerCase() === 'drake') {
        return mockMemes.find(m => m.name === 'Drake Hotline Bling') || null;
      }
      return null;
    });

    const result = await findMemeByDescription(123, 'that approval disapproval meme');

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockFindMemeInCache).toHaveBeenCalledWith('drake');
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Drake Hotline Bling' })
    ]));
  });

  it('should use individual words as fallback if AI and direct search fail', async () => {
    // Return memes that don't match directly
    const nonMatchingMemes = [
      { id: '5', name: 'Grumpy Cat', captions: 50000 },
    ];
    mockGetMemesFromCacheOrApi.mockResolvedValue(nonMatchingMemes);

    // AI returns empty keywords
    mockGenerateContent.mockResolvedValue({ text: '' });

    // Mock findMemeInCache to return Spider-Man meme for 'spiderman'
    mockFindMemeInCache.mockImplementation(async (query: string) => {
      if (query.toLowerCase() === 'spiderman') {
        return mockMemes.find(m => m.name === 'Spider-Man Pointing') || null;
      }
      return null;
    });

    const result = await findMemeByDescription(123, 'pointing spiderman');

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockFindMemeInCache).toHaveBeenCalledWith('pointing');
    expect(mockFindMemeInCache).toHaveBeenCalledWith('spiderman');
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Spider-Man Pointing' })
    ]));
  });

  it('should handle AI keyword extraction failure gracefully', async () => {
    // Return memes that don't match directly
    mockGetMemesFromCacheOrApi.mockResolvedValue([
      { id: '5', name: 'Grumpy Cat', captions: 50000 },
    ]);

    // AI throws an error
    mockGenerateContent.mockRejectedValue(new Error('AI API is down'));

    // Mock findMemeInCache to return Two Buttons for 'choice'
    mockFindMemeInCache.mockImplementation(async (query: string) => {
      if (query.toLowerCase() === 'choice') {
        return mockMemes.find(m => m.name === 'Two Buttons') || null;
      }
      return null;
    });

    const result = await findMemeByDescription(123, 'sweating guy choice');

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockFindMemeInCache).toHaveBeenCalledWith('sweating');
    expect(mockFindMemeInCache).toHaveBeenCalledWith('choice');
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Two Buttons' })
    ]));
  });

  it('should return an empty array if no memes are found', async () => {
    // Make all search paths return no results
    mockGetMemesFromCacheOrApi.mockResolvedValue([
      { id: '5', name: 'Completely Different Meme Name', captions: 50000 },
    ]);
    mockGenerateContent.mockResolvedValue({ text: 'nonexistent, fake' });
    mockFindMemeInCache.mockResolvedValue(null);

    const result = await findMemeByDescription(123, 'xyz123nonexistent');

    expect(result).toHaveLength(0);
  });

  it('should limit the number of results', async () => {
    const manyMemes = Array.from({ length: 20 }, (_, i) => ({
      id: `${i}`,
      name: `TestMeme ${i}`,
      captions: 1000 - i
    }));
    mockGetMemesFromCacheOrApi.mockResolvedValue(manyMemes);

    const result = await findMemeByDescription(123, 'TestMeme');

    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('should not return duplicate memes', async () => {
    // Return memes that don't match directly
    mockGetMemesFromCacheOrApi.mockResolvedValue([
      { id: '5', name: 'Grumpy Cat', captions: 50000 },
    ]);

    // AI returns keywords that all resolve to the same meme
    mockGenerateContent.mockResolvedValue({ text: 'drake, hotline, bling' });

    // All keywords return the same Drake meme
    mockFindMemeInCache.mockResolvedValue(mockMemes[0]);

    const result = await findMemeByDescription(123, 'drake hotline bling');
    console.log("Result:n\n\n\n", result)


    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  describe('AI Retry Logic', () => {
    it('should retry AI call on retryable error', async () => {
      // Make direct search fail
      mockGetMemesFromCacheOrApi.mockResolvedValue([
        { id: '5', name: 'Grumpy Cat', captions: 50000 },
      ]);

      // Mark error as retryable
      mockIsRetryableError.mockReturnValue(true);
      mockCalculateDelay.mockReturnValue(100);

      // First call fails, second succeeds
      mockGenerateContent
        .mockRejectedValueOnce(new Error('Retryable error') as never)
        .mockResolvedValue({ text: 'drake' });

      mockFindMemeInCache.mockResolvedValue(mockMemes[0]);

      await findMemeByDescription(123, 'some random text');

      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(mockIsRetryableError).toHaveBeenCalledWith(expect.any(Error));
      expect(mockCalculateDelay).toHaveBeenCalledWith(1);
    });

    it('should not retry on non-retryable error', async () => {
      // Make direct search fail
      mockGetMemesFromCacheOrApi.mockResolvedValue([
        { id: '5', name: 'Grumpy Cat', captions: 50000 },
      ]);

      // Mark error as non-retryable
      mockIsRetryableError.mockReturnValue(false);

      mockGenerateContent.mockRejectedValue(new Error('Non-retryable error'));
      mockFindMemeInCache.mockResolvedValue(null);

      await findMemeByDescription(123, 'some random text');

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(mockCalculateDelay).not.toHaveBeenCalled();
    });
  });
});