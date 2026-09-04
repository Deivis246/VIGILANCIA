import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({});

const transcriptionResponseSchema = {
  type: "OBJECT",
  properties: {
    rows: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          bedId: { type: "STRING", nullable: true },
          occupied: { type: "BOOLEAN", nullable: true },
          patientCode: { type: "STRING", nullable: true },
          diagnosis: { type: "STRING", nullable: true },
          stayDays: { type: "INTEGER", nullable: true },
          urinaryCatheterDays: { type: "INTEGER", nullable: true },
          nasogastricTubeDays: { type: "INTEGER", nullable: true },
          centralLineDays: { type: "INTEGER", nullable: true },
          cultureType: { type: "STRING", enum: ["none", "urine", "blood", "respiratory", "other"], nullable: true },
          cultureStatus: { type: "STRING", enum: ["pending", "negative", "positive"], nullable: true },
          cultureOrganism: { type: "STRING", nullable: true },
          culturePositiveDate: { type: "STRING", nullable: true },
          isolation: { type: "STRING", enum: ["none", "respiratory", "contact", "droplets"], nullable: true },
          rectalSwabStatus: { type: "STRING", enum: ["pending", "negative", "positive"], nullable: true },
          rectalSwabOrganism: { type: "STRING", nullable: true },
          rectalSwabPositiveDate: { type: "STRING", nullable: true },
          confidence: { type: "STRING", enum: ["high", "medium", "low"] },
          warnings: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: [
          "bedId", "occupied", "patientCode", "stayDays", "urinaryCatheterDays",
          "nasogastricTubeDays", "centralLineDays", "cultureType", "cultureStatus",
          "cultureOrganism", "culturePositiveDate", "isolation", "rectalSwabStatus", "rectalSwabOrganism",
          "rectalSwabPositiveDate",
          "confidence", "warnings",
        ],
      },
    },
    warnings: { type: "ARRAY", items: { type: "STRING" } },
    reviewedRequired: { type: "BOOLEAN" },
    dynamicTables: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          columns: { type: "ARRAY", items: { type: "STRING" } },
          rows: {
            type: "ARRAY",
            items: {
              type: "ARRAY",
              items: { type: "STRING" },
            },
          },
        },
        required: ["title", "columns", "rows"],
      },
    },
  },
  required: ["rows", "warnings", "reviewedRequired", "dynamicTables"],
};

async function run() {
  try {
    console.log("Calling Gemini...");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: "Extract info from this text: Patient 201-A has no catheter." }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: transcriptionResponseSchema,
      },
    });
    console.log("Success:", response.text);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
