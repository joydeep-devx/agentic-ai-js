import { ChatGroq } from "@langchain/groq";

const llm = new ChatGroq({
  model: "openai/gpt-oss-120b",
  temperature: 0.7,
  maxTokens: undefined,
  maxRetries: 2,
  // other params...
});


export const main = async (prompt) => {
  const aiMsg = await llm.invoke([
    {
      role: "system",
      content: "You are Joule ,my helpful AI assistant.",
    },
    { role: "user", content: prompt },
  ]);

  return aiMsg.content;
};
