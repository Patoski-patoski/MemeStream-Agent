# MemeStream-Agent

A TypeScript-based application that uses Playwright for web scraping and Google's Generative AI to search, scrape, and process meme images from the web.

## Features

- 🔍 Meme search functionality
- 🖼️ Automatic meme template extraction
- 📥 Bulk meme image scraping
- ✨ Type-safe with Zod schema validation
- 🤖 Integration with Google's Generative AI

## Prerequisites

- Node.js (v16 or higher)
- TypeScript
- WSL (Windows Subsystem for Linux) if running on Windows

## Installation

1. Clone the repository:

```bash
git clone [repository-url]
cd MemeStream-Agent
```

1. Install dependencies:

```bash
npm install
```

1. Create a `.env` file in the root directory with the following variables:

```env
MEME_URL=[your-meme-website-url]
```

## Project Structure

```bash
MemeStream-Agent/
├── src/
│   ├── index.ts
│   ├── light.ts
│   ├── weather.ts
│   └── meme-generator/
│       ├── agents/
│       │   └── memegeneratorAgent.ts
│       ├── tools/
│       │   └── meme-generator-tools.ts
│       ├── types/
│       │   └── types.ts
│       └── utils/
│           └── utils.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Core Components

### Meme Generator Tools (`meme-generator-tools.ts`)

Contains the main functionality for interacting with meme websites:

- `searchMemeAndGetFirstLink`: Searches for memes and retrieves the first matching result
- `scrapeMemeImagesFromPage`: Scrapes all meme images from a specific page

### Type Definitions (`types.ts`)

Provides type safety using Zod schemas for:

- Meme input validation
- Meme search results
- Image data structures
- Final output format

## Usage

1. Build the project:

```bash
npm run dev
```

1. The application provides several functions for meme operations:

```typescript
// Search for a specific meme
const searchResult = await searchMemeAndGetFirstLink(page, "your meme name");

// Scrape meme images from a page
const memeImages = await scrapeMemeImagesFromPage(page, memePageUrl);
```

## Dependencies

- `@google/genai`: Google's Generative AI integration
- `playwright`: Web automation and scraping
- `dotenv`: Environment variable management
- `zod`: Runtime type checking and validation
- `typescript`: Static type checking

## Development

1. Run the TypeScript compiler in watch mode:

```bash
npm run dev
```

1. The compiled JavaScript files will be output to the `dist` directory.

## Error Handling

The application includes comprehensive error handling:

- Input validation using Zod schemas
- Null checks for web elements
- Timeout handling for web requests
- Detailed error logging

## Contributing

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Submit a pull request

## License

ISC

## Note

This project is designed to respect website terms of service and includes appropriate delays between requests. Please ensure you have permission to scrape content from your target websites.
