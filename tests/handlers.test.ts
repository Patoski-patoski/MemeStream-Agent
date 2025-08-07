
import { jest } from '@jest/globals';
import TelegramBot from 'node-telegram-bot-api';
import { setupBotCommands, handleStartCommand, handleHelpCommand } from '../src/bot/core/handlers';

// Mock TelegramBot
const mockBot = {
    setMyCommands: jest.fn(),
    sendMessage: jest.fn(),
    onText: jest.fn(),
} as unknown as TelegramBot;

describe('Bot Command Handlers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('setupBotCommands', () => {
        it('should set bot commands correctly', async () => {
            await setupBotCommands(mockBot);

            expect(mockBot.setMyCommands).toHaveBeenCalledTimes(3); // Once for all, once for private, once for group
            expect(mockBot.setMyCommands).toHaveBeenCalledWith([
                { command: 'start', description: '🎭 Welcome message and bot introduction' },
                { command: 'meme', description: '🔍 Full meme search with history and examples' },
                { command: 'blank', description: '🎨 Get blank meme template instantly' },
                { command: 'help', description: '❓ Show help and usage instructions' }
            ]);
            expect(mockBot.setMyCommands).toHaveBeenCalledWith([
                { command: 'start', description: '🎭 Welcome message and bot introduction' },
                { command: 'meme', description: '🔍 Full meme search with history and examples' },
                { command: 'blank', description: '🎨 Get blank meme template instantly' },
                { command: 'help', description: '❓ Show help and usage instructions' }
            ], { scope: { type: 'all_private_chats' } });
        });
    });

    describe('handleStartCommand', () => {
        it('should send the welcome message on /start command', () => {
            const mockOnTextCallback = jest.fn();
            (mockBot.onText as jest.Mock).mockImplementationOnce((regex, callback) => {
                mockOnTextCallback(regex);
                callback({ chat: { id: 123 } } as TelegramBot.Message);
            });

            handleStartCommand(mockBot);

            expect(mockOnTextCallback).toHaveBeenCalledWith(/^\/start$/);
            expect(mockBot.sendMessage).toHaveBeenCalledWith(
                123,
                expect.stringContaining('🎭 *Welcome to Meme Generator Bot!* 🎭'),
                { parse_mode: 'Markdown' }
            );
        });
    });

    describe('handleHelpCommand', () => {
        it('should send the help message on /help command', () => {
            const mockOnTextCallback = jest.fn();
            (mockBot.onText as jest.Mock).mockImplementationOnce((regex, callback) => {
                mockOnTextCallback(regex);
                callback({ chat: { id: 456 } } as TelegramBot.Message);
            });

            handleHelpCommand(mockBot);

            expect(mockOnTextCallback).toHaveBeenCalledWith(/^\/help$/);
            expect(mockBot.sendMessage).toHaveBeenCalledWith(
                456,
                expect.stringContaining('🤖 **Meme Generator Bot Help** 🤖'),
                { parse_mode: 'Markdown' }
            );
        });
    });
});
