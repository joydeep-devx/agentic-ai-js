import "dotenv/config";
import { ChatGoogle } from "@langchain/google";
import { z } from "zod";
import prompt from "prompt-sync";
import { AIMessage, HumanMessage, SystemMessage } from "langchain";

// input instance
const input = prompt();

// Initialize model instance
const model = new ChatGoogle({
  model: "gemini-3.5-flash-lite",
  temperature: 0.4,
});

// Output topic schema
const TopicSchema = z.object({
  topic: z.string(),
  definition: z.string(),
  keyPoints: z.array(z.string()),
});

// Structured model
const stucturedModel = model.withStructuredOutput(TopicSchema);

// System Message
const sysMsg = new SystemMessage("You are Joule , a good Teacher");

// chat history
const messages = [sysMsg];
console.log("joule: Hi , I am Joule how can I help you !");
while (true) {
  let prompt = input("user : ");
  // Exit condition
  if (prompt.trim() === "/bye") break;

  let userMsg = new HumanMessage(prompt);
  messages.push(userMsg);

  try {
    let response = await stucturedModel.invoke(messages);
    // Show output
    console.log("joule : ");
    console.log(`${response.topic} : ${response.definition}`);
    console.log("Key Points : ");
    for (let point of response.keyPoints) {
      console.log(` - ${point}`);
    }
    // push result to maintain history
    let aiMsg = new AIMessage(JSON.stringify(response));
    messages.push(aiMsg);
  } catch (err) {
    console.log("Something went wrong ", err.message);
    break;
  }
}
