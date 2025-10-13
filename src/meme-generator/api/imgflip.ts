// src/meme-generator/api/imgflip.ts
import { ImgflipMeme } from '../../bot/types/types.js';
import { memeCache } from '../../bot/core/cache.js';
import { bot } from '../../bot/core/bot.js';
import { formatMemeNameForUrl } from '../../bot/utils/formatters.js';
const MEME_URL = process.env.MEME_URL;


/**
 * Fetches the list of memes from the ImgFlip API and searches for a specific meme.
 * @param memeName The name of the meme to search for.
 *
 * @returns A promise that resolves to the meme object if found, otherwise null.
 */
export const getMemeFromImgFlip = async (memeName: string): Promise<ImgflipMeme | null> => {
  try {
    console.log(`Searching for meme: "${memeName}"`);
    const memes = await memeCache.getMemesFromCacheOrApi();

    const lowerCaseMemeName = memeName.trim().toLowerCase();
    const searchTerms = lowerCaseMemeName.split(/\s+/);

    const meme = memes.find(m => {
      const memeNameLower = m.name.toLowerCase();
      return searchTerms.every(term => memeNameLower.includes(term));
    });
    console.log("meme", meme);


    return meme || null;
  } catch (error) {
    console.error('Error fetching from ImgFlip API:', error);
    return null;
  }
};

export const getBlankMemeFromApi = async (chatId: number, memeName: string) => {
  const foundMeme = await getMemeFromImgFlip(memeName);

  if (foundMeme) {
    console.log(`✅ Found "${memeName}" in API cache as "${foundMeme.name}". Sending instantly.`);
    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: '🖼️ View Examples', callback_data: `view_examples_${chatId}` }, { text: '🔍 Full Meme Info', callback_data: `full_info_${chatId}` }],
        [{ text: '🔄 Get Another Blank', callback_data: `new_blank_${chatId}` }]
      ]
    };
    await memeCache.setUserContext(chatId, {
      memePageUrl: `https://imgflip.com/meme/${foundMeme.id}/${formatMemeNameForUrl(foundMeme.name)}`,
      blankTemplateUrl: foundMeme.url,
      memeName: foundMeme.name,
      currentPage: 1,
      lastRequestTime: Date.now()
    });
    await bot.sendPhoto(chatId, foundMeme.url, {
      caption: `🎨 *Blank Template: "${foundMeme.name}"*\n✨ *Create your own version:* [here](${MEME_URL}/${formatMemeNameForUrl(foundMeme.name)})\n💡 *Tips:* Right-click to save, use the link to add text, or use the buttons below.`,
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
    await memeCache.cacheBlankMeme(memeName, foundMeme.url);
    return { success: true, url: foundMeme.url };
  } else {
    await bot.sendMessage(chatId, `❌ *Meme not found*\n\nI couldn't find a meme called \"${memeName}\". Please try a different name.`);
    throw new Error(`Meme not found: ${memeName}`);
  }
};