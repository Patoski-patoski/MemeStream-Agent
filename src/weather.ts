import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const modelName = process.env.MODEL_NAME!;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getWeather({ location }: { location: string }) {
    console.log(`Tool call: getWeather(location=${location})...`);
    const toolResponse = mockGetWeather(location);
    console.log(`Tool response: ${JSON.stringify(toolResponse)}`);
    return toolResponse;
}

export function set_thermostat_temp({ temperature }: { temperature: number }) {
    console.log(`Tool call: set_thermostat_temp(temperature=${temperature})...`);
    // Here you would implement the logic to set the thermostat temperature
    const toolResponse = mockSetThermostatTemp(temperature);
    console.log(`Tool response: ${JSON.stringify(toolResponse)}`);
    return toolResponse;
}

const toolFunctions: Record<string, Function> = {
    get_weather_forecast: getWeather,
    set_thermostat_temperature: set_thermostat_temp,
};

type ContentPart =
    | { text: string }
    | { functionCall: { name: string; args: Record<string, any> } }
    | { functionResponse: { name: string; response: Record<string, any> } };

const tools = [
    {
        functionDeclarations: [
            {
                name: "get_weather_forecast",
                description:
                    "Gets the current weather temperature for a given location.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        location: {
                            type: Type.STRING,
                        },
                    },
                    required: ["location"],
                },
            },
        ],
    },
    {
        functionDeclarations: [
            {
                name: "set_thermostat_temperature",
                description: "Sets the thermostat to a desired temperature.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        temperature: {
                            type: Type.NUMBER,
                        },
                    },
                    required: ["temperature"],
                },
            },
        ],
    },
];

let contents: { role: string; parts: ContentPart[] }[] = [
    {
        role: 'user',
        parts: [{ text: "If it's warmer than 20 in London, set the thermostat to  20°C, otherwise set it to 18°C." }]
    }
]

while (true) {
    const result = await ai.models.generateContent({
        model: modelName,
        contents,
        config: { tools },
    });

    console.log("Model response:", JSON.stringify(result, null, 2));

    // Capture the model's actual response content for the conversation history
    // This could be text or a functionCall from the model
    if (result.candidates && result.candidates[0] && result.candidates[0].content) {
        contents.push(result.candidates[0].content as { role: string; parts: ContentPart[]; });
        console.log("Appended model's response to history:", JSON.stringify(contents[contents.length - 1]));
    }


    if (result.functionCalls && result.functionCalls.length > 0) {
        const functionCall = result.functionCalls[0];
        console.log("Function call detected:", JSON.stringify(functionCall, null, 2));
        const { name, args } = functionCall;

        console.log("functionCall:", functionCall);

        if (typeof name !== "string" || !toolFunctions[name]) {
            console.error(`Unknown function call: ${name}`);
            break;
        }

        console.log(`Executing tool: ${name} with args:`, args);
        // Call the function and get the response.
        const toolResponse = await toolFunctions[name](args);
        console.log(`Tool response for ${name}:`, JSON.stringify(toolResponse, null, 2));

        const functionResponsePart: ContentPart = {
            functionResponse: { // Correct key for sending tool results
                name: functionCall.name as string,
                response: toolResponse,
            }
        };

        // Send the function response back to the model with role 'tool'
        contents.push({
            role: 'tool', // CORRECT ROLE: 'tool' or 'function'
            parts: [functionResponsePart],
        });
        console.log("Appended tool's response to history:", JSON.stringify(contents[contents.length - 1]));

    } else {
        // No more function calls, print the final response and break the loop
        console.log("Final AI Response:");
        console.log(result.text);
        break;
    }
}

function mockGetWeather(location: string) {
    console.log(`Mock: Getting weather for ${location}`);
    if (location.toLowerCase() === 'london') {
        return { temperature: 22, unit: "celsius" };
    }
    return { temperature: 15, unit: "celsius" };
}

function mockSetThermostatTemp(temperature: number) {
    console.log(`Mock: Setting thermostat to ${temperature}°C`);
    return { status: "success", setTemperature: temperature };
}

