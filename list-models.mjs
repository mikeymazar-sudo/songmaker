import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "AIzaSyCNGsbjss6jEKKnTqAHUU0_MylG1ny-_-Q" });

async function listModels() {
    try {
        const response = await ai.models.list();
        console.log(response);
        if (response) {
            for await (const model of response) {
                console.log(`Model: ${model.name}`);
            }
        }
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
