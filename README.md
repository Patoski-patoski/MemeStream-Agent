
# Meme Generator Agent

## Overview

The **Meme Generator Agent** is an AI-powered agent built with the Mastra framework that allows users to search for internet memes, retrieve meme templates, and get engaging descriptions and usage information about popular memes. It leverages web scraping and LLM capabilities to provide a rich, interactive meme discovery experience.

### Features

- **Meme Search**: Enter the name of a meme to find its template and related images.
- **Template Scraping**: Automatically scrapes meme templates from imgflip.com.
- **Meme Descriptions**: Uses an LLM to generate fun, informative descriptions and usage history for each meme.
- **Template Listing**: Presents a formatted list of meme templates with names and image URLs.
- **Blank Template Retrieval**: Offers users the option to get a blank meme template for customization.

### Folder Structure

```bash
src/mastra/agents/meme-generator/
  ├── agents/           # (Reserved for agent-specific logic or sub-agents)
  ├── meme-generator-workflow.ts  # Main workflow orchestrating meme search and scraping
  ├── tools/
  │   ├── meme-generator-tools.ts # Core scraping and search logic using Playwright
  │   ├── index.ts                # (Entry point for tools, if needed)
  │   └── practice.js             # (Experimental or practice code)
  ├── types/
  │   └── types.ts      # Zod schemas and TypeScript types for meme data
  └── utils/
      └── utils.ts      # Utility functions for URL handling and image extraction
```

### How It Works

1. **User Input**: The user provides the name of a meme. E.g Chill guy, Distracted Boyfriend, Drake Hotline Bling
2. **Search Step**: The agent uses Playwright to search imgflip.com for the meme, retrieving the first result's page URL and blank template image.
3. **Scraping Step**: The agent scrapes all meme images/templates from the meme's page.
4. **LLM Description**: The agent prompts the LLM to generate a description and a formatted list of meme templates.
5. **Response**: The agent returns the meme page URL, blank template, a description, and a list of customized meme templates.

### Key Files

- **meme-generator-workflow.ts**: Defines the workflow, including steps for searching memes and scraping templates, and orchestrates LLM calls for descriptions.
- **tools/meme-generator-tools.ts**: Contains Playwright-based functions for searching memes and scraping images.
- **types/types.ts**: Defines Zod schemas and TypeScript types for meme input, output, and image data.
- **utils/utils.ts**: Utility functions for formatting meme names, building URLs, and extracting image data from web pages.

### Type Definitions

- `MemeInput`: `{ memeName: string }` — The meme to search for.
- `MemeSearchResult`: `{ memePageFullUrl: string, memeBlankImgUrl: string }`
- `MemeImageData`: `{ alt: string, src: string }`
- `FinalMemeData`: `{ pageUrl: string, blankTemplateUrl: string, description: string, memeExamples: MemeImageData[] }`

### Environment Variables

- The agent uses environment variables for configuration (e.g., LLM endpoint). See `.env.example` for required variables.

### Dependencies

- **Mastra**: For agent and workflow orchestration.
- **Playwright**: For headless browser automation and web scraping.
- **Zod**: For schema validation and type inference.
- **dotenv**: For environment variable management.

### Setup Instructions

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Configure environment**:
   - Copy `.env.example` to `.env` and fill in required values.

3. **Run the agent**:

   ```bash
   pnpm run dev
   ```

4. **Test locally**:
   - Access the agent at `http://localhost:8080` and interact via the chat interface.

### Docker Usage

To build and run the agent in Docker:

#### **Option 1: Pull and Run the Pre-built Image (Recommended for Most Users)**

```sh
docker pull patrickpatoski/agent-challenge:latest
docker run -p 8080:8080 --env-file .env patrickpatoski/agent-challenge:latest
```

#### **Option 2: If you forked the repo. Build Locally (For Developers/Contributors)**

```sh
docker build -t yourdockerusername/agent-challenge:latest .
docker run -p 8080:8080 --env-file .env patrickpatoski/agent-challenge:latest
```

### Example Usage

- **Input**: `"Chill guy"`
- **Output**:  
  - Meme page URL
  - Blank template image URL for user to customize
  - Description/history of the meme
  - List of already customized meme template images with names
  
