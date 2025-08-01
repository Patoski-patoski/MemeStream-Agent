# MemeStream-Agent

A TypeScript-based Telegram bot that uses Playwright for web scraping and Google's Generative AI to search, scrape, and process meme images from the web. Get instant access to meme templates, origin stories, and examples right in your Telegram chat!

## Features
- 🤖 Integration with Google's Generative AI
- 🤖 Telegram Bot Integration for easy meme access
- 🔍 Smart meme search functionality
- 📚 Detailed meme origin stories and history
- 🖼️ Automatic meme template extraction
- 📥 Bulk meme image scraping with previews
- ✨ Type-safe with OpenAPI schema validation
- 🎭 Rich meme examples and usage context
- ⚡ Real-time progress tracking

## Prerequisites

- Node.js (v16 or higher)
- An `ngrok` account or other tunneling service to expose your local server to the internet.
- A Telegram Bot Token (get from [@BotFather](https://t.me/botfather))
- A Google Generative AI API Key

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/patoski-patoski/MemeStream-Agent.git
    cd MemeStream-Agent
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Create a `.env` file in the root directory and add the following variables.
    ```env
    # Your Telegram Bot token from @BotFather
    TELEGRAM_BOT_TOKEN=your_telegram_bot_token

    # Your public URL from ngrok or a similar service
    WEBHOOK_URL=https://your-ngrok-url.ngrok.io

    # The port your local server will run on
    PORT=3300

    # Your Gemini API Key
    GEMINI_API_KEY=your_gemini_api_key
    MODEL_NAME=gemini-pro
    ```

## Development

This project uses `nodemon` and `ts-node` for a streamlined development experience.

1.  **Start your tunneling service** to expose your local port. For example, using `ngrok`:

    ```bash
    ngrok http 3000
    ```
    Copy the HTTPS forwarding URL provided by `ngrok` into the `WEBHOOK_URL` variable in your `.env` file.

2.  **Start the bot** in development mode:

    ```bash
    npm run dev
    ```
    `nodemon` will watch for any changes in the `src` directory and automatically restart the bot.

## Usage

Once the bot is running and the webhook is set:

1.  Open Telegram and find your bot.
2.  Send commands to interact with it:
    -   `/start` - Get a welcome message and instructions.
    -   `/meme [name]` - Search for a specific meme.

    **Example:**
    ```
    /meme Distracted Boyfriend
    ```

The bot will respond with the meme's origin story, a blank template, and a collection of image examples.

## Project Structure

```bash
MemeStream-Agent/
├── src/
│   ├── bot/
│   │   ├── core/
│   │   │   ├── bot.ts             # Main bot initialization and orchestration
│   │   │   ├── browser.ts         # Playwright browser management
│   │   │   ├── handlers.ts        # Telegram command and callback handlers
│   │   │   ├── server.ts          # Express server setup and webhook
│   │   │   └── utils.ts           # Utility functions for the bot
│   │   └── bot.ts                 # Main entry point for the bot application
│   └── meme-generator/
│       ├── agents/
│       │   └── memegeneratorAgent.ts
│       ├── tools/
│       │   └── meme-generator-tools.ts
│       ├── types/
│       │   └── types.ts
│       └── utils/
│           └── utils.ts
├── .env.example
├── nodemon.json
├── package.json
├── tsconfig.json
└── README.md
```

## License

This project is licensed under the ISC License.
