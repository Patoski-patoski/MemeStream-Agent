import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

import {
    searchMemeAndGetFirstLink,
    scrapeMemeImagesFromPage
} from '../tools/meme-generator-tools.js';

import { ContentPart } from '../types/types.js';

dotenv.config();

const modelName = process.env.MODEL_NAME!;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const toolFunctions: Record<string, Function> = {
    searchMeme: searchMemeAndGetFirstLink,
    scrapeMemeImages: scrapeMemeImagesFromPage
};

