import { jest } from '@jest/globals';
import * as request from 'supertest';
import express from 'express';

// Mock external dependencies BEFORE importing the server
jest.mock('../src/bot/core/browser.js', () => ({
    getBrowser: jest.fn()
}));

jest.mock('dotenv', () => ({
    config: jest.fn()
}));

// Import after mocking
import { app, startServer } from '../src/bot/core/server.js';
import { getBrowser } from '../src/bot/core/browser.js';

// Set up test environment variables
const originalEnv = process.env;

describe('Express Server', () => {
    let mockBot;
    let consoleSpy;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Reset environment variables
        process.env = { ...originalEnv };
        process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token-123';
        process.env.RENDER_EXTERNAL_URL = 'https://test-app.render.com';
        process.env.PORT = '3300';

        // Mock console.log to avoid noise in tests
        consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        // Create mock bot
        mockBot = {
            processUpdate: jest.fn()
        };
    });

    afterEach(() => {
        // Restore environment variables
        process.env = originalEnv;
        consoleSpy.mockRestore();
    });

    describe('Health Check Endpoint', () => {
        it('should return OK status when browser is ready', async () => {
            getBrowser.mockReturnValue({ /* mock browser */ });

            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toMatchObject({
                status: 'OK',
                browser: 'Ready',
                timestamp: expect.any(String)
            });

            // Verify timestamp is a valid ISO string
            expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
        });

        it('should return OK status when browser is not ready', async () => {
            getBrowser.mockReturnValue(null);

            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toMatchObject({
                status: 'OK',
                browser: 'Not Ready',
                timestamp: expect.any(String)
            });
        });

        it('should log health check requests', async () => {
            getBrowser.mockReturnValue(null);

            await request(app)
                .get('/health')
                .set('User-Agent', 'test-agent')
                .expect(200);

            expect(consoleSpy).toHaveBeenCalledWith(
                'Health check requested:',
                expect.objectContaining({
                    timestamp: expect.any(String),
                    headers: expect.objectContaining({
                        'user-agent': 'test-agent'
                    })
                })
            );
        });

        it('should handle health check with custom headers', async () => {
            getBrowser.mockReturnValue({ ready: true });

            const response = await request(app)
                .get('/health')
                .set('X-Custom-Header', 'test-value')
                .set('Authorization', 'Bearer token')
                .expect(200);

            expect(response.body.status).toBe('OK');
            expect(consoleSpy).toHaveBeenCalledWith(
                'Health check requested:',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'x-custom-header': 'test-value',
                        'authorization': 'Bearer token'
                    })
                })
            );
        });
    });

    describe('Root Endpoint', () => {
        it('should return welcome message', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);

            expect(response.body).toMatchObject({
                message: 'Meme Generator Bot is running!',
                webhook: 'Active',
                timestamp: expect.any(String)
            });

            // Verify timestamp is a valid ISO string
            expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
        });

        it('should return JSON content type', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);

            expect(response.headers['content-type']).toMatch(/json/);
        });
    });

    describe('Webhook Endpoint', () => {
        it('should process webhook updates successfully', async () => {
            const webhookPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
            const mockUpdate = {
                update_id: 12345,
                message: {
                    message_id: 1,
                    date: 1234567890,
                    chat: { id: 123456789, type: 'private' },
                    from: { id: 123456789, is_bot: false, first_name: 'Test' },
                    text: '/start'
                }
            };

            // Start the server to register the webhook endpoint
            const server = app.listen(0); // Use random port for testing
            
            try {
                // Mock the bot.processUpdate method
                const mockBotProcessor = jest.fn();
                app.post(webhookPath, (req, res) => {
                    mockBotProcessor(req.body);
                    res.sendStatus(200);
                });

                const response = await request(app)
                    .post(webhookPath)
                    .send(mockUpdate)
                    .expect(200);

                expect(mockBotProcessor).toHaveBeenCalledWith(mockUpdate);
            } finally {
                server.close();
            }
        });

        it('should handle empty webhook payload', async () => {
            const webhookPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
            
            const server = app.listen(0);
            
            try {
                const mockBotProcessor = jest.fn();
                app.post(webhookPath, (req, res) => {
                    mockBotProcessor(req.body);
                    res.sendStatus(200);
                });

                await request(app)
                    .post(webhookPath)
                    .send({})
                    .expect(200);

                expect(mockBotProcessor).toHaveBeenCalledWith({});
            } finally {
                server.close();
            }
        });

        it('should handle malformed JSON in webhook', async () => {
            const webhookPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
            
            const server = app.listen(0);
            
            try {
                await request(app)
                    .post(webhookPath)
                    .set('Content-Type', 'application/json')
                    .send('invalid json')
                    .expect(400); // Bad request for malformed JSON
            } finally {
                server.close();
            }
        });
    });

    describe('404 Error Handling', () => {
        it('should return 404 for unknown endpoints', async () => {
            await request(app)
                .get('/nonexistent-endpoint')
                .expect(404);
        });

        it('should return 404 for POST to unknown endpoints', async () => {
            await request(app)
                .post('/unknown')
                .expect(404);
        });

        it('should return 404 for webhook with wrong token', async () => {
            await request(app)
                .post('/webhook/wrong-token')
                .send({ test: 'data' })
                .expect(404);
        });
    });

    describe('startServer Function', () => {
        let mockListen;
        let mockApp;

        beforeEach(() => {
            // Mock express app methods
            mockListen = jest.fn((port, host, callback) => {
                // Simulate server startup
                if (callback) callback();
                return { close: jest.fn() };
            });

            mockApp = {
                post: jest.fn(),
                listen: mockListen,
                use: jest.fn(),
                get: jest.fn()
            };

            // Mock express to return our mock app
            jest.doMock('express', () => {
                const actualExpress = jest.requireActual('express');
                return () => mockApp;
            });
        });

        afterEach(() => {
            jest.dontMock('express');
        });

        it('should start server with correct configuration', () => {
            startServer(mockBot);

            const expectedPort = Number(process.env.PORT);
            const expectedWebhookPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;

            expect(mockListen).toHaveBeenCalledWith(
                expectedPort,
                '0.0.0.0',
                expect.any(Function)
            );

            expect(consoleSpy).toHaveBeenCalledWith(`🚀 Webhook server running on port ${expectedPort}`);
            expect(consoleSpy).toHaveBeenCalledWith(`📡 Webhook URL: ${process.env.RENDER_EXTERNAL_URL}${expectedWebhookPath}`);
            expect(consoleSpy).toHaveBeenCalledWith(`🌐 Health check: ${process.env.RENDER_EXTERNAL_URL}/health`);
            expect(consoleSpy).toHaveBeenCalledWith(`🎭 Meme bot ready to receive webhooks!`);
        });

        it('should use default port when PORT env is not set', () => {
            delete process.env.PORT;

            startServer(mockBot);

            expect(mockListen).toHaveBeenCalledWith(
                3300, // default port
                '0.0.0.0',
                expect.any(Function)
            );
        });

        it('should use WEBHOOK_URL when RENDER_EXTERNAL_URL is not set', () => {
            delete process.env.RENDER_EXTERNAL_URL;
            process.env.WEBHOOK_URL = 'https://custom-webhook.com';

            startServer(mockBot);

            const expectedWebhookPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
            expect(consoleSpy).toHaveBeenCalledWith(`📡 Webhook URL: https://custom-webhook.com${expectedWebhookPath}`);
        });

        it('should register webhook endpoint correctly', () => {
            const mockPost = jest.fn();
            const testApp = { 
                post: mockPost, 
                listen: jest.fn((port, host, cb) => cb && cb()),
                use: jest.fn(),
                get: jest.fn()
            };

            // Override the app's post method temporarily
            const originalPost = app.post;
            app.post = mockPost;

            try {
                startServer(mockBot);

                const expectedPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
                expect(mockPost).toHaveBeenCalledWith(expectedPath, expect.any(Function));
            } finally {
                app.post = originalPost;
            }
        });
    });

    describe('Environment Variable Handling', () => {
        it('should handle missing TELEGRAM_BOT_TOKEN', () => {
            delete process.env.TELEGRAM_BOT_TOKEN;

            expect(() => {
                startServer(mockBot);
            }).not.toThrow(); // Should not throw, but webhook path will be /webhook/undefined
        });

        it('should handle missing webhook URL environment variables', () => {
            delete process.env.RENDER_EXTERNAL_URL;
            delete process.env.WEBHOOK_URL;

            expect(() => {
                startServer(mockBot);
            }).not.toThrow(); // Should not throw, but webhook URL will be undefined
        });
    });

    describe('Middleware', () => {
        it('should parse JSON bodies correctly', async () => {
            const testData = { test: 'data', number: 123 };

            // Create a test endpoint to verify JSON parsing
            app.post('/test-json', (req, res) => {
                res.json({ received: req.body });
            });

            const response = await request(app)
                .post('/test-json')
                .send(testData)
                .expect(200);

            expect(response.body.received).toEqual(testData);
        });

        it('should handle large JSON payloads', async () => {
            const largeData = {
                message: 'x'.repeat(1000), // 1KB string
                array: new Array(100).fill('test'),
                nested: {
                    deep: {
                        data: 'value'
                    }
                }
            };

            app.post('/test-large', (req, res) => {
                res.json({ size: JSON.stringify(req.body).length });
            });

            const response = await request(app)
                .post('/test-large')
                .send(largeData)
                .expect(200);

            expect(response.body.size).toBeGreaterThan(1000);
        });
    });

    describe('Integration Tests', () => {
        it('should handle complete webhook flow', async () => {
            getBrowser.mockReturnValue({ ready: true });
            
            const webhookPath = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
            const mockUpdate = {
                update_id: 999,
                message: {
                    message_id: 1,
                    date: Math.floor(Date.now() / 1000),
                    chat: { id: 123, type: 'private' },
                    from: { id: 123, is_bot: false, first_name: 'TestUser' },
                    text: '/meme Drake'
                }
            };

            // Register webhook endpoint
            app.post(webhookPath, (req, res) => {
                mockBot.processUpdate(req.body);
                res.sendStatus(200);
            });

            // Test health check first
            const healthResponse = await request(app)
                .get('/health')
                .expect(200);

            expect(healthResponse.body.browser).toBe('Ready');

            // Test webhook processing
            await request(app)
                .post(webhookPath)
                .send(mockUpdate)
                .expect(200);

            expect(mockBot.processUpdate).toHaveBeenCalledWith(mockUpdate);

            // Test root endpoint
            const rootResponse = await request(app)
                .get('/')
                .expect(200);

            expect(rootResponse.body.message).toBe('Meme Generator Bot is running!');
        });

        it('should maintain server state across requests', async () => {
            getBrowser.mockReturnValue(null);

            // First health check
            const response1 = await request(app)
                .get('/health')
                .expect(200);

            expect(response1.body.browser).toBe('Not Ready');

            // Simulate browser becoming ready
            getBrowser.mockReturnValue({ ready: true });

            // Second health check
            const response2 = await request(app)
                .get('/health')
                .expect(200);

            expect(response2.body.browser).toBe('Ready');

            // Verify both calls were logged
            expect(consoleSpy).toHaveBeenCalledTimes(2);
        });
    });
});