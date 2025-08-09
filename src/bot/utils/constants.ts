export const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 10000,
    backoffMultiplier: 2
};

export const MAX_RETRIES = 5;
export const INITIAL_RETRY_DELAY = 1000; 
export const MAX_RETRY_DELAY = 30000;
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
