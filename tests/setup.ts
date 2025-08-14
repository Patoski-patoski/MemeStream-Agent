import { jest } from '@jest/globals';

// Suppress console.error messages during tests
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
