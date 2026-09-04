import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const data = fs.readFileSync('../../CamScanner 29-08-2026 07.35.pdf');
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [{ role: 'user', parts: [
      { inlineData: { data: data.toString('base64'), mimeType: 'application/pdf' } },
      { text: "EXTRAE TODAS LAS TABLAS EXACTAMENTE COMO APARECEN (dynamicTables): Identifica cualquier tabla visible (ej. 'Resumen del Día', 'Censo Clínico', cuadros de aislamiento). Para cada tabla, extrae su título y las columnas. Devuelve un JSON: { dynamicTables: [{ title, columns }] }" }
    ]}],
    config: { responseMimeType: 'application/json' },
  });
  console.log(response.text);
}
run().catch(console.error);
