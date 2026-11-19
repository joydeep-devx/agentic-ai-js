import "dotenv/config";
import { ChatGoogle } from "@langchain/google";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough } from "@langchain/core/runnables";

// Initialize the model
const model = new ChatGoogle({
  model: "gemini-3.5-flash-lite",
});

// Initialize the parser
const parser = new StringOutputParser();

// Create Explain prompt template & chain
const explainPrompt = PromptTemplate.fromTemplate("Explain {topic} in simply");
const explainChain = explainPrompt.pipe(model).pipe(parser);

// Create Example prompt template
const examplePrompt = PromptTemplate.fromTemplate(
  "Give five examples of {topic}",
);
const exampleChain = examplePrompt.pipe(model).pipe(parser);

// Create Advantage prompt template
const advantagePrompt = PromptTemplate.fromTemplate(
  "List five advantages of {topic}",
);
const advantageChain = advantagePrompt.pipe(model).pipe(parser);

// Combine the branches using Runnable
const parallelChain = RunnablePassthrough.assign({
  explanation: explainChain,
  advantages: advantageChain,
  example: exampleChain,
});

// Create the final prompt and end chain
const finalPrompt = PromptTemplate.fromTemplate(
  `You are an educational content writer.

  Create a well-structured explanation of the topic: {topic}

  Use the following information:

  Explanation:
  {explanation}

  Practical Example:
  {example}

  Advantages:
  {advantages}

  Combine all the information into one coherent response.
  Avoid unnecessary repetition and use clear headings.
  Do not omit any important information.
`,
);
const finalChain = finalPrompt.pipe(model).pipe(parser);

// Join the parallel chain with finalchain
const completeChain = parallelChain.pipe(finalChain);

// invoke the chain
const result = await completeChain.invoke({
  topic: "AI",
});

console.log(result);
