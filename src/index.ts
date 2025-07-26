import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const modelName = process.env.MODEL_NAME!;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
console.log(process.env.GEMINI_API_KEY);

const powerDiscoBall = {
    name: "power_disco_ball",
    description: "Powers the spinning of the disco ball.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            power: {
                type: Type.BOOLEAN,
                description: "Whether the disco ball is powered on or off."
            }
        },
        required: ["power"]
    }
};

const startMusic = {
    name: "start_music",
    description: "Play some music matching the specified parameters",
    parameters: {
        type: Type.OBJECT,
        properties: {
            energetic: {
                type: Type.BOOLEAN,
                description: "Whether the music is energetic or not."
            },
            loud: {
                type: Type.BOOLEAN,
                description: "Whether the music is loud or not."
            }
        },
        required: ["energetic", "loud"]
    }
};

const dimLights = {
    name: "dim_lights",
    description: "Dim the lights",
    parameters: {
        type: Type.OBJECT,
        properties: {
            brightness: {
                type: Type.NUMBER,
                description: "The brightness level to set the lights to, from 0.0 (off) to 1.0 (full brightness)."
            }
        },
        required: ["brightness"]
    }
};

const houseFuncs = [powerDiscoBall, startMusic, dimLights];
const config = {
    tools: [{ functionDeclarations: houseFuncs }],
    toolConfig: {
        functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY
        }
    }
};

const chat = ai.chats.create({
    model: modelName,
    config: config
});

(async () => {
    const response = await chat.sendMessage({
        message: 'Turn this place into a party!'
    });
    // console.log("Response:", response);
    console.log("Example1 : Forced function calling");

    for (const fn of response.functionCalls!) {
        const args = Object.entries(fn.args!)
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ");
        console.log(`Calling function: ${fn.name} with args: ${args}`);
    }
})();