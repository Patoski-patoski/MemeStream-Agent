// utils.ts
export class UrlUtils {
    static createFullUrl(href: string | null, baseUrl: string): string {
        if (!href) {
            throw new Error("Invalid href provided");
        }

        return href.startsWith('http') ? href : new URL(href, baseUrl).href;
    }
}

export class MemeUtils {
    static formatMemeAltText(alt: string): string {
        // Split at first '|'
        const [title, rest] = alt.split('|').map(s => s.trim());
        if (!rest) return title;

        // Split rest at first ';' or '|'
        const subtitle = rest.split(/[;|]/)[0].trim();
        return `${title}-${subtitle}`;
    }
}