import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface VocabEntry {
  word: string;
  meaning: string;
  synonym: string;
  antonym: string;
  day_number: number;
}

export async function extractVocabFromText(ocrText: string): Promise<VocabEntry[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract vocabulary entries from the following OCR text of a PDF. 
    The text contains tables with columns: Words, Parts of speech, Meaning, Synonym, Antonym.
    Organize the words into "Days" of 15 words each.
    Return only the information found in the text. Do not generate new meanings or synonyms.
    
    OCR Text:
    ${ocrText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          words: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                meaning: { type: Type.STRING },
                synonym: { type: Type.STRING },
                antonym: { type: Type.STRING },
                day_number: { type: Type.INTEGER }
              },
              required: ["word", "meaning", "day_number"]
            }
          }
        }
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '{"words": []}');
    return data.words;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return [];
  }
}
