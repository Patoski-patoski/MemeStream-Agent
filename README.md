# MemeStream Agent 🎭

> A Telegram bot that discovers, analyzes, and delivers meme templates with AI-powered context.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/Patoski-patoski/MemeStream-Agent/actions)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## 📖 Table of Contents

- [MemeStream Agent 🎭](#memestream-agent-)
  - [📖 Table of Contents](#-table-of-contents)
  - [🎯 About The Project](#-about-the-project)
    - [Architecture Overview](#architecture-overview)
  - [🚀 Key Features](#-key-features)
  - [🛠️ Technical Stack](#️-technical-stack)
  - [🏁 Getting Started](#-getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Configuration](#configuration)
  - [💡 Usage](#-usage)
  - [📂 Project Structure](#-project-structure)
  - [🤝 Contributing](#-contributing)
  - [📜 License](#-license)
  - [📞 Contact](#-contact)

---

## 🎯 About The Project

MemeStream Agent is a full-stack TypeScript application that combines web scraping, AI integration, and bot development to create an intelligent meme discovery platform. It allows users to request memes by name, and the bot will deliver a blank template, a brief history of the meme, and a gallery of examples.

This project demonstrates a robust, scalable, and resilient architecture, with a focus on performance optimization and a great user experience.

### Architecture Overview

```bash
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Telegram Bot  │───▶│  Meme Agent     │───▶│  Web Scraping   │
│   (Webhook)     │    │  (AI Logic)     │    │  (Playwright)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Interface│    │   Google Gemini │    │   Meme Database │
│   (Commands)    │    │   (AI Context)  │    │   (Templates)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🚀 Key Features

- **🤖 Intelligent Meme Discovery**: Utilizes natural language processing to understand user requests and handle variations in meme names.
- **🎨 Instant Template Generation**: Delivers blank meme templates for customization, along with a gallery of examples.
- **🧠 AI-Powered Context**: Provides historical and cultural background for each meme using Google Gemini.
- **⚡ High Performance**: Optimized for speed and low memory usage, with concurrent processing and resource pooling.
- **🛡️ Error Resilience**: Graceful degradation and intelligent retry logic ensure high availability.

---

## 🛠️ Technical Stack

- **Backend**: TypeScript, Node.js, Express.js
- **Bot Framework**: node-telegram-bot-api
- **Web Scraping**: Playwright
- **AI**: Google Gemini (Function Calling, Streaming)
- **Infrastructure**: Docker, Webhooks

---

## 🏁 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- Node.js (v16 or higher)
- Docker (optional, for containerized deployment)
- An `ngrok` account or other tunneling service to expose your local server to the internet.
- A Telegram Bot Token (get from [@BotFather](https://t.me/botfather))
- A Google Generative AI API Key

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/Patoski-patoski/MemeStream-Agent.git
    cd MemeStream-Agent
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

### Configuration

1. Create a `.env` file in the root directory by copying the example file:

    ```bash
    cp .env.example .env
    ```

2. Open the `.env` file and add your credentials:

    ```bash
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

---

## 💡 Usage

1. **Start your tunneling service** to expose your local port. For example, using `ngrok`:

    ```bash
    ngrok http 3300
    ```

    Copy the HTTPS forwarding URL provided by `ngrok` into the `WEBHOOK_URL` variable in your `.env` file.

2. **Start the bot** in development mode:

    ```bash
    npm run dev
    ```

    `nodemon` will watch for any changes in the `src` directory and automatically restart the bot.

3. **Interact with the bot** in Telegram:

    - `/start` - Get a welcome message and instructions.
    - `/meme [name]` - Search for a specific meme (e.g., `/meme Distracted Boyfriend`).
    - `/blank [name]` - Get a blank meme template (e.g., `/blank Drake hotline bling`).

---

## 📂 Project Structure

```bash
MemeStream-Agent/
├── .github/                # GitHub Actions workflows
├── dist/                   # Compiled TypeScript files
├── src/                    # Source code
│   ├── bot/                # Telegram bot logic
│   │   ├── core/           # Core bot functionalities
│   │   ├── types/          # TypeScript types for the bot
│   │   └── utils/          # Utility functions for the bot
│   └── meme-generator/     # Meme agent and tools
│       ├── agents/         # AI agent for meme generation
│       ├── tools/          # Web scraping and other tools
│       ├── types/          # TypeScript types for the meme generator
│       └── utils/          # Utility functions for the meme generator
├── tests/                  # Test files
├── .dockerignore           # Docker ignore file
├── .env.example            # Example environment variables
├── .gitignore              # Git ignore file
├── Dockerfile              # Docker configuration
├── eslint.config.ts        # ESLint configuration
├── jest.config.mjs         # Jest configuration
├── nodemon.json            # Nodemon configuration
├── package.json            # Project dependencies and scripts
├── README.md               # This file
└── tsconfig.json           # TypeScript configuration
```

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 📞 Contact

Patrick Patoski - [@codesbypatrick](https://twitter.com/codesbypatrick)

Project Link: [https://github.com/Patoski-patoski/MemeStream-Agent](https://github.com/Patoski-patoski/MemeStream-Agent)

Live Demo: [@MemeStreamAgentBot](https://t.me/MemeStreamAgentBot)
