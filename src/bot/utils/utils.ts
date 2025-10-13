// src/bot/core/utils.ts

import { ProgressTracker } from '../types/types.js';
import TelegramBot from 'node-telegram-bot-api';

export const progressMessages = [
    "🔍 Initializing meme search...",
    "🌐 Navigating to meme database...",
    "🎯 Found your meme! Gathering details...",
    "📚 Researching meme origin story...",
    "🖼️ Collecting meme images...",
    "📊 Processing and organizing data...",
    "✨ Almost ready! Finalizing results..."
];



/**
 * Updates a Telegram message to display the current progress of a meme search.
 *
 * @param bot Telegram bot instance
 * @param tracker ProgressTracker instance
 * @param message Text to display alongside the progress bar
 * @param emoji Optional emoji to prefix the progress bar with
 */
export async function updateProgress(bot: TelegramBot, tracker: ProgressTracker, message: string, emoji?: string) {
    const elapsed = Math.round((Date.now() - tracker.startTime) / 1500);
    const progressBar = "█".repeat(tracker.currentStep) + "░".repeat(tracker.totalSteps - tracker.currentStep);

    try {
        await bot.editMessageText(
            `${emoji || "⏳"} *Processing your meme request...*\n\n` +
            `📊 Progress: [${progressBar}] ${tracker.currentStep}/${tracker.totalSteps}\n\n` +
            `${message}\n\n` +
            `⏱️ Elapsed: ${elapsed}s | Estimated: 15-20s`,
            {
                chat_id: tracker.chatId,
                message_id: tracker.messageId,
                parse_mode: 'Markdown'
            }
        );
    } catch (error) {
        console.error('Error updating progress:', error);
    }
}

    /**
     * Construct a URL by appending a page number to the given base URL.
     * If the base URL is malformed, this function will fall back to appending the page number
     * as a query parameter (e.g. `baseUrl?page=123`).
     * @param baseUrl The base URL to append the page number to.
     * @param pageNumber The page number to append.
     * @returns The constructed URL.
     */
export function constructPageUrl(baseUrl: string, pageNumber: number): string {
    try {
        const url = new URL(baseUrl);
        url.searchParams.set('page', pageNumber.toString());
        return url.toString();
    } catch (error) {
        // Fallback for malformed URLs
        console.log(error)
        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}page=${pageNumber}`;
    }
}