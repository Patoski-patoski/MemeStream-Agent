
import { chromium, Browser } from 'playwright';

let globalBrowser: Browser | undefined;
let isBrowserLaunching = false;

export const initializeBrowser = async () => {
    if (globalBrowser || isBrowserLaunching) {
        console.log('Browser already initialized or launching...');
        return;
    }
    isBrowserLaunching = true;
    console.log('Launching Playwright browser...');
    try {
        globalBrowser = await chromium.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log('Playwright browser launched.');
    } catch (error) {
        console.error('Failed to launch Playwright browser:', error);
        process.exit(1);
    } finally {
        isBrowserLaunching = false;
    }
};

export const getBrowser = () => globalBrowser;

export const gracefulShutdown = async (signal: string) => {
    console.log(`\n📡 Received ${signal}. Shutting down webhook server and browser...`);

    if (globalBrowser) {
        console.log('🌐 Closing Playwright browser...');
        await globalBrowser.close();
        console.log('✅ Playwright browser closed.');
    }

    console.log('👋 Webhook server shutdown complete');
    process.exit(0);
};
