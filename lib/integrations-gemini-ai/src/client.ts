import { GoogleGenAI } from "@google/genai";

if (!process.env.GOOGLE_GEMINI_API_KEY) {
  throw new Error(
    "GOOGLE_GEMINI_API_KEY must be set. Create a key in Google AI Studio and save it as a Replit Secret.",
  );
}

export const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
});
