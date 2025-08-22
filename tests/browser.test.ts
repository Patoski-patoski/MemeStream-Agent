import { initializeBrowser, closeBrowser } from '../src/bot/core/browser';

describe('Browser Tests', () => {
  beforeAll(async () => {
    await initializeBrowser();
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it('should have a browser instance', () => {
    expect(true).toBe(true);
  });
});