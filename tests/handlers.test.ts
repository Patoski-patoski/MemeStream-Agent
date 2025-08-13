import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import TelegramBot from 'node-telegram-bot-api';
import {
    setupBotCommands,
    handleStartCommand,
    handleHelpCommand,
    handleBlankMemeCommand,
    handleMemeCommand,
    handleCallbackQuery
} from '../src/bot/core/handlers';

import { memeCache } from '../src/bot/core/cache';

jest.mock('../src/bot/core/browser');
jest.mock('../src/meme-generator/agents/memegeneratorAgent');
jest.mock('../src/meme-generator/tools/meme-generator-tools');


const mockBot = {
    setMyCommands: jest.fn(),
    onText: jest.fn(),
    on: jest.fn(),
    sendMessage: jest.fn(),
    editMessageText: jest.fn(),
    deleteMessage: jest.fn(),
    sendPhoto: jest.fn(),
    answerCallbackQuery: jest.fn(),
} as unknown as TelegramBot;

describe('Bot Handlers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(memeCache, 'getUserContext').mockResolvedValue(null); // Default mock
    });

    describe('setupBotCommands', () => {
        it('should set the bot commands', async () => {
            await setupBotCommands(mockBot);
            expect(mockBot.setMyCommands).toHaveBeenCalledTimes(3);
            expect(mockBot.setMyCommands).toHaveBeenCalledWith([
                { command: 'start', description: '🎭 Welcome message and bot introduction' },
                { command: 'meme', description: '🔍 Full meme search with history and examples' },
                { command: 'blank', description: '🎨 Get blank meme template instantly' },
                { command: 'help', description: '❓ Show help and usage instructions' },
            ]);
        });
    });

    describe('handleStartCommand', () => {
        it('should register a listener for the /start command', () => {
            handleStartCommand(mockBot);
            expect(mockBot.onText).toHaveBeenCalledWith(/^\/start$/, expect.any(Function));
        });

        it('should send a welcome message when /start is called', () => {
            handleStartCommand(mockBot);
            const callback = (mockBot.onText as jest.Mock).mock.calls[0][1] as (msg: TelegramBot.Message, args: string[]) => void;
            const msg = { chat: { id: 123 } } as TelegramBot.Message;
            callback(msg, ["array of word"]);
            expect(mockBot.sendMessage).toHaveBeenCalledWith(123, expect.any(String), { parse_mode: 'Markdown' });
        });
    });

    describe('handleHelpCommand', () => {
        it('should register a listener for the /help command', () => {
            handleHelpCommand(mockBot);
            expect(mockBot.onText).toHaveBeenCalledWith(/^\/help$/, expect.any(Function));
        });

        it('should send a help message when /help is called', () => {
            handleHelpCommand(mockBot);
            const callback = (mockBot.onText as jest.Mock).mock.calls[0][1] as (msg: TelegramBot.Message, args: string[]) => void;

            const msg = { chat: { id: 123 } } as TelegramBot.Message;
            callback(msg, ["array of word"]);
            expect(mockBot.sendMessage).toHaveBeenCalledWith(123, expect.any(String), { parse_mode: 'Markdown' });
        });
    });

    describe('handleBlankMemeCommand', () => {
        it('should register a listener for the /blank command', () => {
            handleBlankMemeCommand(mockBot);
            expect(mockBot.onText).toHaveBeenCalledWith(/^\/blank( (.+))?/, expect.any(Function));
        });

        it('should ask for a meme name if none is provided', async () => {
            handleBlankMemeCommand(mockBot);
            const callback = (mockBot.onText as jest.Mock).mock.calls[0][1] as (msg: TelegramBot.Message, args: string[]) => void;

            const msg = { chat: { id: 123 } } as TelegramBot.Message;
            await callback(msg, ['/blank', undefined!]);
            expect(mockBot.sendMessage).toHaveBeenCalledWith(123, expect.stringContaining('Please provide a meme name'), { parse_mode: 'Markdown' });
        });
    });

    describe('handleMemeCommand', () => {
        it('should register a listener for the /meme command', () => {
            handleMemeCommand(mockBot);
            expect(mockBot.onText).toHaveBeenCalledWith(/^\/meme( (.+))?/, expect.any(Function));
        });

        it('should ask for a meme name if none is provided', async () => {
            handleMemeCommand(mockBot);
            const callback = (mockBot.onText as jest.Mock).mock.calls[0][1] as (msg: TelegramBot.Message, args: string[]) => void;

            const msg = { chat: { id: 123 } } as TelegramBot.Message;
            callback(msg, ['/meme', undefined!]);
            expect(mockBot.sendMessage).toHaveBeenCalledWith(123, expect.stringContaining('Please provide a meme name'), { parse_mode: 'Markdown' });
        });
    });

    describe('handleCallbackQuery', () => {
        it('should register a listener for callback queries', () => {
            handleCallbackQuery(mockBot);
            expect(mockBot.on).toHaveBeenCalledWith('callback_query', expect.any(Function));
        });

        it('should handle view_examples callback', async () => {
            (memeCache.getUserContext as jest.Mock).mockResolvedValueOnce(
                {
                    memeName: 'test',
                    memePageUrl: 'http://test.com'
                } as never);

            handleCallbackQuery(mockBot);
            const callback = (mockBot.on as jest.Mock).mock.calls[0][1] as (query: TelegramBot.CallbackQuery) => void;
            const query = { id: '1', message: { chat: { id: 123 } }, data: 'view_examples_123' } as TelegramBot.CallbackQuery;
            await callback(query);

            expect(memeCache.getUserContext).toHaveBeenCalledWith(123);
            expect(mockBot.sendMessage).toHaveBeenCalledWith(123, expect.any(String), { parse_mode: 'Markdown' });
        });
    });
});