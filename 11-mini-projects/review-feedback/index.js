import "dotenv/config";
import { ChatGoogle } from "@langchain/google";
import { RunnableBranch } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

// Initialize the model
const model = new ChatGoogle({
  model: "gemini-3.5-flash-lite",
});

// Initilaize the parser
const parser = new StringOutputParser();

// Prompt to get the structured output
const classifyPrompt = PromptTemplate.fromTemplate(
  `Classify the following customer review.
  Return the original review as feedback and classify it
  as either POSITIVE or NEGATIVE.

  Review: {review}`,
);

// Structure of the output
const ReviewType = z.object({
  feedback: z.string(),
  type: z.enum(["POSITIVE", "NEGATIVE"]),
});

// Structured output model
const classifyModel = model.withStructuredOutput(ReviewType);

// Classify chain
const classifyChain = classifyPrompt.pipe(classifyModel);

// Positive Review Chain
const postiveTemplate = PromptTemplate.fromTemplate(
  `{feedback} is given.
    Send an appropriate response thanking the customer.`,
);
const positiveChain = postiveTemplate.pipe(model).pipe(parser);

// Negative Review Chain
const negativeTemplate = PromptTemplate.fromTemplate(
  `{feedback} is given.
  Send an apology response to the customer for the inconvenience.`,
);
const negativeChain = negativeTemplate.pipe(model).pipe(parser);


// Create the conditional chain
const conditionalChain = RunnableBranch.from([
  [(input) => input.type === "POSITIVE", positiveChain],
  [(input) => input.type === "NEGATIVE", negativeChain],
  negativeChain,
]);

// Merge all chains
const completeChain = classifyChain.pipe(conditionalChain);

// A user's review
const prompt = {
  review: `The overall experience was quite disappointing. The product quality was below my expectations, and the service was slow. I had to wait longer than expected, and the staff didn't seem particularly helpful. I hope the management takes customer feedback seriously and works on improving the experience. Unfortunately, I wouldn't recommend it based on my experience.`,
};

// Invoke the comlete chain
const result = await completeChain.invoke(prompt);
console.log(result);
