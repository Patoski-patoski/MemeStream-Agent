export const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 10000,
    backoffMultiplier: 2
};

export const TIMEOUTS = {
    PAGE_LOAD: 30000,
    SEARCH_WAIT: 1500,
    ELEMENT_WAIT: 20000,
    SCROLL_DELAY: 200,
} as const;

export const SELECTORS = {
    SEARCH_INPUT: '#mm-search',
    FIRST_RESULT: '.mm-rec-link',
    PREVIEW_IMAGE: '.mm-img.shadow',
} as const;