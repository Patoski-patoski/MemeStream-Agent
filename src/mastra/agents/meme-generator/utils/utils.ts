// utils/utils.ts
import { Page } from 'playwright';
import { MemeImageData } from '../types/types';


function formatMemeAltText(text: string): string {
    // Split at first '|'
    const [title, rest] = text.split('|').map(s => s.trim());
    if (!rest) return title;

    // Split rest at first ';' or ',' or '|'
    const subtitle = rest.split(/[;|,]/)[0].trim();
    return `${title}-${subtitle}`;
}

export function createFullUrl(href: string | null, baseUrl: string): string {
    if (!href) throw new Error("Invalid href provided");

    return href.startsWith('http')
        ? href
        : new URL(href, baseUrl).href;
}

export async function extractMemeImageData(page: Page): Promise<MemeImageData[]> {
    const rawImageData: MemeImageData[] = await page.$$eval('img.base-img', (imgs: Element[]) =>
        (imgs as HTMLImageElement[]).map(img => ({
            alt: img.alt,
            src: img.src
        }))
    );

    return rawImageData.map(data => ({
        ...data,
        alt: formatMemeAltText(data.alt)
    }));
}