import { jest, describe, it, expect, beforeEach, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { app, startServer, closeServer } from '../src/bot/core/server';

jest.mock('../src/bot/core/browser', () => {
    const originalModule = jest.requireActual('../src/bot/core/browser') as object;
    return {
        __esModule: true,
        ...originalModule,
        getBrowser: jest.fn(),
    };
});

import { getBrowser } from '../src/bot/core/browser';


describe('Server', () => {
    afterEach(() => {
        closeServer();
    });

    describe('GET /health', () => {

        it('should return 200 OK from / endpoint', async () => {
            const response = await request(app).get('/');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                message: 'Meme Generator Bot is running!',
                webhook: 'Active',
                timestamp: expect.any(String),
            });
        });

        it('should return 200 OK from /health endpoint', async () => {
            const response = await request(app).get('/health');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                status: 'OK',
                timestamp: expect.any(String),
                browser: expect.any(String),
            });
        });

        it('should return 200 OK and browser not ready status', async () => {
            (getBrowser as jest.Mock).mockResolvedValue;
            const response = await request(app).get('/health');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                status: 'OK',
                timestamp: expect.any(String),
                browser: 'Not Ready',
            });
        });
    });

    describe('GET /', () => {
        it('should return 200 OK and a welcome message', async () => {
            const response = await request(app).get('/');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                message: 'Meme Generator Bot is running!',
                webhook: 'Active',
                timestamp: expect.any(String),
            });
        });
    });

    describe('startServer', () => {
        const OLD_ENV = process.env;

        beforeEach(() => {
            jest.resetModules()
            process.env = { ...OLD_ENV };
        });

        afterAll(() => {
            process.env = OLD_ENV;
        });

        it('should start the server and setup webhook', (done) => {
            const bot = {
                processUpdate: jest.fn()
            };
            process.env.TELEGRAM_BOT_TOKEN = 'test-token';
            process.env.WEBHOOK_URL = 'http://test.com';

            const server = startServer(bot);
            server.on('listening', () => {
                const address = server.address();
                if (typeof address === 'object' && address !== null) {
                    expect(address.port).toBe(3300);
                }
                server.close(done);
            });
        });

        it('should close the server successfully', async () => {
            const server = startServer({ processUpdate: jest.fn() });
            closeServer();
            expect(server.listening).toBe(false);
        });

    });
});
