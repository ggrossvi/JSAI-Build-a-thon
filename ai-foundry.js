import dotenv from 'dotenv';

dotenv.config();

import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
  const client = new ModelClient(
  process.env.AZURE_INFERENCE_SDK_ENDPOINT ?? "https://aistudioaiservices321222617631.services.ai.azure.com/models", new AzureKeyCredential(process.env.AZURE_INFERENCE_SDK_KEY ?? "YOUR_KEY_HERE"));

var messages = [
  { role: "system", content: "You are an helpful assistant" },
  { role: "user", content: "What are 3 things to see in Seattle?" },
];

var response = await client.path("chat/completions").post({
  body: {
    messages: messages,
    max_tokens: 2048,
      temperature: 0.8,
      top_p: 0.1,
      presence_penalty: 0,
      frequency_penalty: 0,
      model: "Llama-4-Maverick-17B-128E-Instruct-FP8",
  },
});

console.log(JSON.stringify(response));
