import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/* To get response in detokenized form  */
export const main = async (prompt) => {
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
  });

  return response.text;
};

/* Get Stream reponse */  
export const mainStream = async (prompt) => {
  const stream = await ai.models.generateContentStream({
    model: "gemini-3.1-flash-lite",
    contents: `${prompt}`,
  });

  for await (const chunk of stream) {
    console.log(chunk.text);
  }
};


