import "dotenv/config";
import prompt from "prompt-sync";
import { ChatGoogle } from "@langchain/google";

const input = prompt();

const model = new ChatGoogle({
  model: "gemini-3.5-flash-lite",
});

console.log("Ask Something ...");
while (true) {
  let userMsg = input("user : ");
  if (userMsg.trim() === "/bye") {
    break;
  }

  let response = await model.invoke([
    {
      role: "system",
      content: "You are Joule my helpful assistant",
    },
    {
      role: "user",
      content: userMsg,
    },
  ]);
  console.log(`Joule : ${response.content}`);
}
