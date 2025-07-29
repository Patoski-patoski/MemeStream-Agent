# MemeStream-Agent

A TypeScript-based Telegram bot that uses Playwright for web scraping and Google's Generative AI to search, scrape, and process meme images from the web. Get instant access to meme templates, origin stories, and examples right in your Telegram chat!

## Features

- 🤖 Telegram Bot Integration for easy meme access
- 🔍 Smart meme search functionality
- � Detailed meme origin stories and history
- �🖼️ Automatic meme template extraction
- 📥 Bulk meme image scraping with previews
- ✨ Type-safe with OpenAPI schema validation
- 🤖 Integration with Google's Generative AI
- 🎭 Rich meme examples and usage context
- ⚡ Real-time progress tracking

## Prerequisites

- Node.js (v16 or higher)
- TypeScript
- WSL (Windows Subsystem for Linux) if running on Windows
- Telegram Bot Token (get from [@BotFather](https://t.me/botfather))
- Google Generative AI API Key

## Installation

1. Clone the repository:

```bash
git clone [repository-url]
cd MemeStream-Agent
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
GEMINI_API_KEY=your_gemini_api_key
MODEL_NAME=gemini-pro
```

## Project Structure

```bash
MemeStream-Agent/
├── src/
│   ├── bot/
│   │   └── bot.ts             # Telegram bot implementation
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

### Telegram Bot (`bot.ts`)

The main bot implementation that handles:

- Telegram message processing and commands
- Real-time progress tracking and updates
- Image collection and formatting
- Error handling and graceful shutdowns
- Browser session management

### Meme Generator Agent (`memegeneratorAgent.ts`)

The core meme processing engine that provides:

- Meme search and verification
- Origin story generation
- Image scraping and collection
- Comprehensive error handling

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

1. Build and start the bot:

```bash
npm run dev
```

2. In Telegram, interact with your bot:

- `/start` - Get welcome message and instructions
- `/meme [name]` - Search for a specific meme
  
Example:

```bash
/meme Distracted Boyfriend
```

The bot will respond with:

- Meme origin story
- Template URL
- Example images
- Usage context

3. For programmatic usage, the application provides several functions:

```typescript
// Initialize the meme agent
const response = await runMemeAgent("Distracted Boyfriend", responseHandler);

// Direct tool usage
const searchResult = await searchMemeAndGetFirstLink(page, "your meme name");
const memeImages = await scrapeMemeImagesFromPage(page, memePageUrl);
```

## Dependencies

- `@google/genai`: Google's Generative AI integration
- `node-telegram-bot-api`: Telegram Bot API integration
- `playwright`: Web automation and scraping
- `dotenv`: Environment variable management
- `zod`: Runtime type checking and validation
- `typescript`: Static type checking

## Development

1. Run the TypeScript compiler in watch mode:

```bash
npm run dev
```

2. The compiled JavaScript files will be output to the `dist` directory.

## Error Handling

The application includes comprehensive error handling:

- Telegram bot message validation
- Input validation using Zod schemas
- Browser session management
- Null checks for web elements
- Timeout handling for web requests
- Graceful shutdowns
- Rate limiting protection
- Detailed error logging
- User-friendly error messages

## Bot Commands

- `/start` - Display welcome message and usage instructions
- `/meme [name]` - Search for a specific meme and get its details

## Contributing

1. Fork the repository
1. Create a new branch
1. Make your changes
1. Submit a pull request

## License

ISC

## Notes

- This project is designed to respect website terms of service and includes appropriate delays between requests
- The bot includes rate limiting to prevent abuse
- Image processing is limited to prevent excessive resource usage
- All responses are formatted for optimal Telegram viewing
