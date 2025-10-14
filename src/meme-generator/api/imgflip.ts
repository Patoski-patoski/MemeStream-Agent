// src/meme-generator/api/imgflip.ts - Enhanced version with fuzzy search

// import Fuse from 'fuse';
import { ImgflipMeme } from '../../bot/types/types.js';
import { memeCache } from '../../bot/core/cache.js';
import { bot } from '../../bot/core/bot.js';
import { formatMemeNameForUrl } from '../../bot/utils/formatters.js';

const MEME_URL = process.env.MEME_URL;

export const getMemeFromImgFlip = async (
  memeName: string
): Promise<ImgflipMeme | null> => {
  try {
    console.log(`🔍 Searching for meme: "${memeName}" using memeCache...`);

    const foundMeme = await memeCache.findMemeInCache(memeName);

    if (foundMeme) {
      console.log(`✅ Found: "${foundMeme.name}"`);
      return foundMeme;
    }

    console.log(`❌ No match found for: "${memeName}" in cache`);
    return null;

  } catch (error) {
    console.error('Error fetching from ImgFlip API via cache:', error);
    return null;
  }
};

/**
 * Send blank meme template to user
 */
export const getBlankMemeFromApi = async (
  chatId: number,
  memeName: string
): Promise<{ success: boolean; url?: string }> => {
  const foundMeme = await getMemeFromImgFlip(memeName);

  if (foundMeme) {
    console.log(`✅ Found "${memeName}" as "${foundMeme.name}". Sending instantly.`);

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '🖼️ View Examples', callback_data: `view_examples_${chatId}` },
          { text: '🔍 Full Meme Info', callback_data: `full_info_${chatId}` }
        ],
        [
          { text: '🔄 Get Another Blank', callback_data: `new_blank_${chatId}` }
        ]
      ]
    };

    await memeCache.setUserContext(chatId, {
      memePageUrl: `https://imgflip.com/meme/${foundMeme.id}/${formatMemeNameForUrl(foundMeme.name)}`,
      blankTemplateUrl: foundMeme.url,
      memeName: foundMeme.name,
      memeId: foundMeme.id,
      currentPage: 1,
      lastRequestTime: Date.now()
    });

    await bot.sendPhoto(chatId, foundMeme.url, {
      caption:
        `🎨 *Blank Template: "${foundMeme.name}"*\n\n` +
        `✨ *Create your own version:* [here](${MEME_URL}/${formatMemeNameForUrl(foundMeme.name)})\n\n` +
        `💡 *Tips:* Right-click to save, use the link to add text, or use the buttons below.`,
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });

    await memeCache.cacheBlankMeme(memeName, foundMeme.url);
    return { success: true, url: foundMeme.url };
  } else {
    await bot.sendMessage(
      chatId,
      `❌ *Meme not found*\n\n` +
      `I couldn't find a meme called "${memeName}".\n\n` +
      `💡 *Try:*\n` +
      `• Checking the spelling\n` +
      `• Using alternative names\n` +
      `• Using /find to describe the meme`,
      { parse_mode: 'Markdown' }
    );
    throw new Error(`Meme not found: ${memeName}`);
  }
};