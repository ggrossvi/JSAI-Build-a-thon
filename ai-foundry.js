/**
 * Run this model in Node.js
 *
 * npm install @azure-rest/ai-inference @azure/core-auth
 */
import dotenv from 'dotenv';
import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
dotenv.config();

//const createClient = require('@azure-rest/ai-inference').default;
//const { AzureKeyCredential } = require('@azure/core-auth');

const client = ModelClient(
    "https://aifoundry520175982409-resource.services.ai.azure.com/models",
    new AzureKeyCredential(process.env.AZURE_INFERENCE_SDK_KEY),
    {
        apiVersion: "2024-05-01-preview"
    }
);

const messages = [
    {
        role: "user",
        content: [
            {
                type: "text",
                text: "INSERT_INPUT_HERE"
            },
        ]
    },
];

async function runChat() {
    while (true) {
        const requestBody = {
            messages: messages,
            model: "Llama-4-Maverick-17B-128E-Instruct-FP8",
            max_tokens: 2048,
        };

        const response = await client.path("/chat/completions").post({
            body: requestBody
        });

        if (response.status !== "200") {
            throw new Error(`Request failed with status ${response.status}: ${response.body?.error?.message || 'Unknown error'}`);
        }

        const choice = response.body.choices[0];

        if (choice.message.tool_calls) {
            console.log("Tool calls:", choice.message.tool_calls);
            messages.push(choice.message);

            for (const toolCall of choice.message.tool_calls) {
                const toolResult = eval(toolCall.function.name)();
                messages.push({
                    role: "tool",
                    content: toolResult,
                    tool_call_id: toolCall.id
                });
            }
        } else {
            console.log(`[Model Response] ${choice.message.content}`);
            break;
        }
    }
}

runChat().catch(console.error); 