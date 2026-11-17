import "dotenv/config";
import { ChatGoogle } from "@langchain/google";
import { AIMessage, HumanMessage, SystemMessage } from "langchain";
import prompt from "prompt-sync";

const input = prompt();

const model = new ChatGoogle({
  model: "gemini-3.5-flash-lite",
});

// conversation history array 
const messages = [];

const systemMsg = new SystemMessage("You are Joule my helpful assistant");
messages.push(systemMsg);

console.log("joule : Hi how can I help you !");
while (true) {
  let userMsg = input("user : ");

  // exit condition 
  if (userMsg.trim() === "/bye") {
    break;
  }
  // create human Message
  let humanMsg = new HumanMessage(userMsg);

  // to maintain conversation history
  messages.push(humanMsg);

  // send all messages array to get response 
  const response = await model.invoke(messages);
  console.log(`joule : ${response.content}`);
  let aiMsg = new AIMessage(response.content);

  // push the result to the messages
  messages.push(aiMsg);
}
