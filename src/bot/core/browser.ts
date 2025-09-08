// src/bot/core/browser.ts
import { chromium, Browser, Page, BrowserContext } from 'playwright';

let globalBrowser: Browser | undefined;
let globalContext: BrowserContext | undefined;
let isBrowserLaunching = false;
const activePagesMap = new Map<string, Page>();

/**
 * Initializes a Playwright browser with optimized settings for serverless environments.
 * It is idempotent and can be called multiple times without launching multiple browsers.
 * If the browser is already launching or initialized, it returns immediately.
 *
 * The browser is launched with the following settings:
 * - `headless: true` to run without a visible window
 * - `--no-sandbox` to reduce memory usage
 * - `--disable-setuid-sandbox` to disable setuid sandboxing
 * - `--disable-dev-shm-usage` to prevent Playwright from writing temporary files to /dev/shm
 * - `--disable-accelerated-2d-canvas` to disable hardware-accelerated 2D canvas rendering
 * - `--no-first-run` to prevent Playwright from running the first-run wizard
 * - `--no-zygote` to disable the zygote process
 * - `--disable-gpu` to disable GPU acceleration
 * - `--memory-pressure-off` to reduce memory pressure warnings
 * - `--max_old_space_size=1024` to limit the V8 heap to 1024MB
 *
 * A persistent context is created with a viewport size of 1280x720.
 *
 * @throws If the browser fails to launch
 */
export const initializeBrowser = async () => {
    if (globalBrowser || isBrowserLaunching) {
        console.log('Browser already initialized or launching...');
        return;
    }

    isBrowserLaunching = true;
    console.log('Launching Playwright browser...');

    try {
        globalBrowser = await chromium.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Important for containers
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--memory-pressure-off', // Reduce memory pressure warnings
                '--max_old_space_size=1024' // Limit V8 heap
            ],
            headless: true
        });

        // Create a persistent context to reuse
        globalContext = await globalBrowser.newContext({
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'
        });

        console.log('Playwright browser launched with optimized settings.');
    } catch (error) {
        console.error('Failed to launch Playwright browser:', error);
        throw error;
    } finally {
        isBrowserLaunching = false;
    }
};

/**
 * Gets an optimized Playwright page with memory-saving settings.
 *
 * If `requestId` is provided, it will attempt to reuse an existing page with the same ID.
 * Otherwise, it will create a new page with a default ID of 'default'.
 *
 * The page is created with the following settings to reduce memory usage:
 * - Resource blocking is enabled to block unnecessary resources like images, fonts, and media.
 * - The page is cleared instead of creating a new one if an existing page with the same ID is found.
 *
 * @param {string} [requestId] The ID of the page to reuse or create.
 * @returns {Promise<Page>} A promise that resolves with an optimized Playwright page.
 */
export const getOptimizedPage = async (requestId?: string): Promise<Page> => {
    if (!globalBrowser || !globalContext) {
        await initializeBrowser();
    }

    if (!globalContext) {
        throw new Error('Browser context not available');
    }

    // Reuse existing page if available, otherwise create new one
    const pageId = requestId || 'default';

    if (activePagesMap.has(pageId)) {
        const existingPage = activePagesMap.get(pageId)!;
        if (!existingPage.isClosed()) {
            // Clear the page instead of creating a new one
            await existingPage.goto('about:blank');
            return existingPage;
        } else {
            activePagesMap.delete(pageId);
        }
    }

    // Create new page with memory optimizations
    const newPage = await globalContext.newPage();

    // Set resource blocking to reduce memory usage
    await newPage.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        // Block unnecessary resources to save memory
        if (['image', 'font', 'media'].includes(resourceType) &&
            !route.request().url().includes('meme')) {
            route.abort();
        } else {
            route.continue();
        }
    });

    activePagesMap.set(pageId, newPage);
    return newPage;
};

/**
 * Closes an existing page and cleans up associated resources.
 *
 * If `requestId` is not provided, it will default to 'default'.
 *
 * @param {string} [requestId] The ID of the page to close.
 */
export const closePage = async (requestId?: string) => {
    const pageId = requestId || 'default';
    const page = activePagesMap.get(pageId);

    if (page && !page.isClosed()) {
        await page.close();
        activePagesMap.delete(pageId);
        console.log(`Page ${pageId} closed and cleaned up`);
    }
};

export const getBrowser = () => globalBrowser;

export const getPageCount = () => activePagesMap.size;

// Enhanced cleanup with memory monitoring
export const closeBrowser = async () => {
    console.log(`\n📡 Shutting down browser...`);

    try {
        // Close all active pages first
        const closingPromises = Array.from(activePagesMap.values()).map(page =>
            page.isClosed() ? Promise.resolve() : page.close()
        );

        await Promise.all(closingPromises);
        activePagesMap.clear();
        console.log('✅ All pages closed');

        // Close context
        if (globalContext) {
            await globalContext.close();
            console.log('✅ Browser context closed');
        }

        // Close browser
        if (globalBrowser) {
            await globalBrowser.close();
            console.log('✅ Playwright browser closed');
        }

        // Force garbage collection if available
        if (global.gc) {
            global.gc();
            console.log('✅ Garbage collection triggered');
        }

    } catch (error) {
        console.error('❌ Error during browser shutdown:', error);
    }

    console.log('👋 Browser shutdown complete');
};

// Memory monitoring utility
export const getMemoryUsage = () => {
    const usage = process.memoryUsage();
    return {
        rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(usage.external / 1024 / 1024)} MB`,
        activePagesCount: activePagesMap.size
    };
};
