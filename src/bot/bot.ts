import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { runMemeAgent } from '../meme-generator/agents/memegeneratorAgent.js';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN must be provided in .env file');
}

// Create a bot instance
const bot = new TelegramBot(token, { polling: true });

// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        'Welcome to MemeStream Bot! 👋\n\n' +
        'Commands:\n' +
        '/meme [name] - Search for a specific meme\n' +
        'Example: /meme distracted boyfriend'
    );
});

// Handle /meme command
bot.onText(/\/meme (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;

    // Extract meme name from the command
    const memeName = match?.[1];

    if (!memeName) {
        bot.sendMessage(chatId, 'Please provide a meme name. Example: /meme chill guy');
        return;
    }

    try {
        // Send initial processing message
        await bot.sendMessage(chatId, `🔍 Searching for "${memeName}" meme...`);

        // Send patience message after 10 seconds
        setTimeout(async () => {
            await bot.sendMessage(chatId,
                `🤖 *Please be patient while I process your request*\n\n` +
                `I'm currently:\n` +
                `• Searching for the perfect meme\n` +
                `• Gathering its origin story\n` +
                `• Collecting the best examples\n\n` +
                `This usually takes about 15-20 seconds...`,
                { parse_mode: 'Markdown' }
            );
        }, 10000);

        setTimeout(async () => { 
            await bot.sendMessage(chatId,
                "Almost there!, Please be patient while I process your request"
            );
        });

        // Create a custom response handler for the meme agent
        const responseHandler = {
            sendUpdate: async (message: string) => {
                // Format and send the origin story
                if (message.includes("Origin Story:")) {
                    const formattedOrigin = `*🎓 Meme Origin and History*\n\n${message}`
                        .replace(/\*\*([^*]+)\*\*/g, '*$1*') // Convert ** to * for Markdown
                        .replace(/\*Origin Story:\*/g, '*📚 Origin Story:*')
                        .replace(/\*How it's Typically Used:\*/g, '*🎯 How it\'s Typically Used:*')
                        .replace(/\*How it Became Popular:\*/g, '*🚀 How it Became Popular:*');

                    await bot.sendMessage(chatId, formattedOrigin, { parse_mode: 'Markdown' });
                } else {
                    // Format and send the final response with meme details
                    const formattedResponse = message
                        .replace(/\*\*([^*]+)\*\*/g, '*$1*')
                        .replace(/Main Page URL:/g, '🔗 *Main Page URL:*')
                        .replace(/Blank Template URL:/g, '🖼 *Blank Template URL:*')
                        .replace(/Scraped Images:/g, '📸 *Available Meme Examples:*');

                    await bot.sendMessage(chatId, formattedResponse, { parse_mode: 'Markdown' });
                }
            },
            sendImages: async (images: { alt: string, src: string }[]) => {
                // Send first 5 most relevant images to avoid overwhelming
                const relevantImages = images
                    .filter(img => !img.alt.toLowerCase().includes('peppa pig')) // Filter out irrelevant memes
                    .slice(0, 5);

                // Send images one by one with formatted captions
                for (const image of relevantImages) {
                    try {
                        const caption = `*${image.alt.split('-')[0]}*\n${image.alt.split('-')[1] || ''}`
                            .replace(/\"/g, ''); // Remove quotes from captions

                        await bot.sendPhoto(chatId, image.src, {
                            caption: caption,
                            parse_mode: 'Markdown'
                        });

                        // Add small delay between images to prevent rate limiting
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (error) {
                        console.error(`Failed to send image: ${image.src}`, error);
                        await bot.sendMessage(chatId, `❌ Failed to send an image example.`,
                            { parse_mode: 'Markdown' });
                    }
                }
            }
        };

        // Run the meme agent with the response handler
        const result = await runMemeAgent(memeName, responseHandler);

        if (!result) {
            await bot.sendMessage(chatId, '❌ Sorry, I couldn\'t find that meme.');
            return;
        }

    } catch (error) {
        console.error('Error in meme command:', error);
        await bot.sendMessage(chatId, '❌ An error occurred while processing your request.');
    }
});

// Handle errors
bot.on('error', (error) => {
    console.error('Telegram bot error:', error);
});

// Log when bot is running
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

console.log('MemeStream Telegram bot is running...');
