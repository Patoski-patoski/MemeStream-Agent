// File: src/mastra/index.ts

import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { weatherAgent } from "./agents/weather-agent/agents/weather-agents"; // This can be deleted later
import { weatherWorkflow } from "./agents/weather-agent/weather-workflow"; // This can be deleted later
import { memeGeneratorWorkflow } from "./agents/meme-generator/meme-generator-workflow";
import { memeGeneratorAgent } from "./agents/meme-generator/agents/meme-generator-agents";
// import { yourAgent } from "./agents/trending-topic-agent/agents/agent"; // Build your agent here

export const mastra = new Mastra({
	workflows: { weatherWorkflow, memeGeneratorWorkflow },
	agents: { weatherAgent, memeGeneratorAgent },
	logger: new PinoLogger({
		name: "Mastra",
		level: "info",
	}),
	server: {
		port: 8080,
		timeout: 10000,
	},
});
