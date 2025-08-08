// src/bot/core/utils.ts

import { ProgressTracker } from '../../meme-generator/types/types.js';
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
    const elapsed = Math.round((Date.now() - tracker.startTime) / 1000);
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

        // Only set deletion timeout once when we reach the final step
        if (tracker.currentStep > 1 && tracker.currentStep === tracker.totalSteps) {
            setTimeout(async () => {
                try {
                    await bot.deleteMessage(tracker.chatId, tracker.messageId);
                } catch (deleteError) {
                    console.error('Error deleting progress message:', deleteError);
                }
            }, 10000);
        }

    } catch (error) {
        console.error('Error updating progress:', error);
    }
}

export function constructPageUrl(baseUrl: string, pageNumber: number): string {
    try {
        const url = new URL(baseUrl);
        url.searchParams.set('page', pageNumber.toString());
        return url.toString();
    } catch (error) {
        // Fallback for malformed URLs
        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}page=${pageNumber}`;
    }
}