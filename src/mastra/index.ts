//src/mastra/index.ts

import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";

import { weatherAgent } from "./agents/weather-agent/agents/weather-agents"; // This can be deleted la
import { weatherWorkflow } from "./agents/weather-agent/weather-workflow"; // This can be deleted later
import { memeGeneratorWorkflow } from './agents/meme-generator/meme-generator-workflow'

export const mastra = new Mastra({
	workflows: { memeGeneratorWorkflow, weatherWorkflow },
	agents: { weatherAgent  },
	logger: new PinoLogger({
		name: "Mastra",
		level: "info",
	}),
	server: {
		port: 8080,
		timeout: 10000,
	},
});



// (async () => {
// 	const run = await mastra.getWorkflow("memeGeneratorWorkflow").createRunAsync();

// 	console.log("Run", run.runId);

// 	const runResult = await run.start({
// 		inputData: { memeName: "Distracted Boyfriend" },
// 	});

// 	console.log("Final output:", runResult);
// })();