import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const modelName = process.env.MODEL_NAME!;
// It's good practice to pass the API key here
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); 

const setLightValues = {
    name: "set_light_values",
    description: 'Sets the brightness and color temperature of the light.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            brightness: {
                type: Type.NUMBER,
                description: "Light level from 0 to 100. Zero is off, 100 is maximum brightness.",
            },
            colorTemperature: {
                type: Type.STRING,
                enum: ['daylight', 'cool', 'warm'],
                description: "Color temperature of the light. Which can be daylight, cool and warm.",
            },
        },
        required: ['brightness', 'colorTemperature'],
    },
};

const config = {
    tools: [{
        functionDeclarations: [setLightValues]
    }]
};

// Define ContentPart type more accurately for function calling context
type ContentPart = 
    | { text: string } 
    | { functionCall: { name: string; args: Record<string, any> } }
    | { functionResponse: { name: string; response: Record<string, any> } };

const contents: { role: string; parts: ContentPart[] }[] = [
    {
        role: "user",
        parts: [{ text: `Turn the light down to a romantic setting.` }]
    },
];

(async () => {
    const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: config
    });

    console.log("Response:", response.functionCalls);

    // Make sure a function call was actually returned by the model
    if (!response.functionCalls || response.functionCalls.length === 0) {
        console.log("Model did not request a function call.");
        console.log(response.text); // Log any text response the model might have given
        return; // Exit if no function call
    }

    const tool_call = response.functionCalls[0];
    let result: object; // Declare result with a type

    if (tool_call.name === 'set_light_values') {
        const args = tool_call.args;
        console.log("Arguments:", args);
        
        if (args
            && typeof args.brightness === 'number'
            && typeof args.colorTemperature === 'string'
        ) {
            result = setLightValuesHandler(args.brightness, args.colorTemperature);
            console.log(`Function call result: ${JSON.stringify(result)}`);
        } else {
            console.error("Invalid or missing arguments for setLightValuesHandler:", args);
            result = { error: "Invalid or missing arguments for function call" };
        }
    } else {
        // Handle cases where the model calls an unexpected function
        console.error(`Model requested an unknown function: ${tool_call.name}`);
        result = { error: `Unknown function: ${tool_call.name}` };
    }

    // Capture the model's functionCall for the conversation history (important!)
    // The initial response.candidates[0].content will contain the model's tool_code call.';
    if (response.candidates && response.candidates[0] && response.candidates[0].content) {
        contents.push(response.candidates[0].content as { role: string; parts: ContentPart[]; });
        console.log("Updated contents with model's tool call (candidate content):", contents[contents.length - 1]);
    }

    // Push the tool's response back to the model with role 'tool'
    contents.push({ 
        role: 'tool',
        parts: [{ 
            functionResponse: {
                name: tool_call.name as string, //\\//\\ Ensure name is a string
                response: result 
            } 
        }] 
    });
    console.log("Updated contents with function response part:", contents[contents.length - 1]);

    for (let index = 0; index < contents.length; index++) {
        const parts = contents[index].parts;
        const role = contents[index].role;
        console.log(`Content ${index + 1} - Role: ${role}, Parts: ${JSON.stringify(parts)}`);
    }

    // Get the final response from the model
    const final_response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: config // Still pass the config so model knows about the tool for future turns
    });

    console.log("Final AI Response:", final_response.text);
    
})();


/**
*   Set the brightness and color temperature of a room light. (mock API)
*   @param {number} brightness - Light level from 0 to 100. Zero is off and 100 is full brightness
*   @param {string} colorTemperature - Color temperature of the light fixture, which can be `daylight`, `cool` or `warm`.
*   @return {Object} A dictionary containing the set brightness and color temperature.
*/
function setLightValuesHandler(brightness: number, colorTemperature: string): object {
    console.log(`--- Mock API Call ---`);
    console.log(`Setting brightness to: ${brightness}, colorTemperature to: ${colorTemperature}`);
    console.log(`---------------------`);
    return {
        brightness: brightness,
        colorTemperature: colorTemperature,
        status: "success" // Added status for clearer mock
    };
}