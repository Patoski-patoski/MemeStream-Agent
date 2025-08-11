import * as request from 'supertest';
import { jest } from '@jest/globals';
import { startServer, app } from '../src/bot/core/server';

// Mock the entire browser module
jest.mock('../src/bot/core/browser', () => ({
    // Use a factory function to return the mocked exports
    getBrowser: jest.fn(),
}));

// Import the mocked getBrowser after the mock definition
import { getBrowser } from '../src/bot/core/browser';

describe('Server Endpoints', () => {
    let mockBot;

    beforeAll(() => {
        // Set up environment variables for testing
        process.env.TELEGRAM_BOT_TOKEN = 'test_token';
        process.env.RENDER_EXTERNAL_URL = 'http://testurl.com';
        process.env.PORT = '3000';

        // Mock bot object with processUpdate method
        mockBot = {
            processUpdate: jest.fn(),
        };

        // Start the server with the mocked bot
        startServer(mockBot);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset the mock before each test
        
    });

    describe('GET /health', () => {
        it('should return 200 and OK status when browser is ready', async () => {
            getBrowser.mockReturnValue({}); // Simulate browser being ready
            const response = await request(app).get('/health');

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe('OK');
            expect(response.body.browser).toBe('Ready');
            expect(response.body).toHaveProperty('timestamp');
        });

        it('should return 200 and Not Ready status when browser is not ready', async () => {
            getBrowser.mockReturnValue(undefined); // Simulate browser not being ready
            const response = await request(app).get('/health');

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe('OK');
            expect(response.body.browser).toBe('Not Ready');
            expect(response.body).toHaveProperty('timestamp');
        });
    });

    describe('GET /', () => {
        it('should return 200 and a welcome message', async () => {
            const response = await request(app).get('/');

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toBe('Meme Generator Bot is running!');
            expect(response.body.webhook).toBe('Active');
            expect(response.body).toHaveProperty('timestamp');
        });
    });

    describe('POST /webhook/:token', () => {
        it('should process update and return 200', async () => {
            const webhookPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
            const mockUpdate = { update_id: 123, message: { text: '/start' } };

            const response = await request(app)
                .post(webhookPath)
                .send(mockUpdate);

            expect(response.statusCode).toBe(200);
            expect(mockBot.processUpdate).toHaveBeenCalledTimes(1);
            expect(mockBot.processUpdate).toHaveBeenCalledWith(mockUpdate);
        });

        it('should return 200 even with an empty body', async () => {
            const webhookPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;

            const response = await request(app)
                .post(webhookPath)
                .send({});

            expect(response.statusCode).toBe(200);
            expect(mockBot.processUpdate).toHaveBeenCalledTimes(1);
            expect(mockBot.processUpdate).toHaveBeenCalledWith({});
        });
    });
});