// to do chunking
//to decouple and use langChain API
//import { isUnexpected } from "@azure-rest/ai-inference";
//import { AzureKeyCredential } from "@azure/core-auth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';


import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import ModelClient from "@azure-rest/ai-inference";
import { AzureChatOpenAI } from "@langchain/openai";

// for memory
import { BufferMemory } from "langchain/memory";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";





dotenv.config();
console.log("Env check:", process.env.INSTANCE_NAME, process.env.DEPLOYMENT_NAME);
const app = express();
app.use(cors());
app.use(express.json());

// In-memory session storage (for demo purposes only)
const sessionMemories = {};
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const pdfPath = path.join(projectRoot, 'data/employee_handbook.pdf'); // Update with your PDF file name


// Function to clear messages from localStorage
// const client = new ModelClient(
//   process.env.AZURE_INFERENCE_SDK_ENDPOINT,
//   new AzureKeyCredential(process.env.AZURE_INFERENCE_SDK_KEY)
// );

// update client initialization to use AzureChatOpenAI
const chatModel = new AzureChatOpenAI({
  azureOpenAIApiKey: process.env.AZURE_INFERENCE_SDK_KEY,
  azureOpenAIApiInstanceName: process.env.INSTANCE_NAME, // In target url: https://<INSTANCE_NAME>.services...
  azureOpenAIApiDeploymentName: process.env.DEPLOYMENT_NAME, // i.e "gpt-4o"
  azureOpenAIApiVersion: "2023-05-15", // In target url: ...<VERSION> //more stable than given version for deployment
  temperature: 1,
  maxTokens: 4096,
});


const instanceName = process.env.INSTANCE_NAME; // e.g. "openai-jsai"
const deploymentName = process.env.DEPLOYMENT_NAME; // e.g. "gpt-4o"
const apiVersion = "2024-11-20";

const fullUrl = `https://${instanceName}.openai.azure.com/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

console.log("Azure OpenAI Full Request URL:", fullUrl);


app.get("/", (req, res) => {
  res.send("Server is running!");
});

let pdfText = null; 
let pdfChunks = []; 
const CHUNK_SIZE = 800; 

//checks if session memory exists, else create new

function getSessionMemory(sessionId) {
  if (!sessionMemories[sessionId]) {
    const history = new ChatMessageHistory();
    sessionMemories[sessionId] = new BufferMemory({
      chatHistory: history,
      returnMessages: true,
      memoryKey: "chat_history",
    });
  }
  return sessionMemories[sessionId];
}

async function loadPDF() {
  console.log("entering loadPDF function")
  if (pdfText) return pdfText;


  if (!fs.existsSync(pdfPath)) return "PDF not found.";

  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer); 
  pdfText = data.text; 
  let currentChunk = ""; 
  const words = pdfText.split(/\s+/); 
  console.log(`PDF loaded with ${words.length} words.`);

  for (const word of words) {
    if ((currentChunk + " " + word).length <= CHUNK_SIZE) {
      currentChunk += (currentChunk ? " " : "") + word;
    } else {
      pdfChunks.push(currentChunk);
      currentChunk = word;
    }
  }
  if (currentChunk) pdfChunks.push(currentChunk);

   // Log chunking results for debugging
  console.log(`PDF loaded and chunked: ${pdfChunks.length} chunks created.`);
  // Optionally, log the first few chunks to inspect their content
  pdfChunks.slice(0, 3).forEach((chunk, idx) => {
    console.log(`Chunk ${idx + 1}:`, chunk.substring(0, 100), '...');
  });


  return pdfText;
}

function retrieveRelevantContent(query) {
  const queryTerms = query.toLowerCase().split(/\s+/) // Converts query to relevant search terms
    .filter(term => term.length > 3)
    .map(term => term.replace(/[.,?!;:()"']/g, ""));

  if (queryTerms.length === 0) return [];
  const scoredChunks = pdfChunks.map(chunk => {
    const chunkLower = chunk.toLowerCase(); 
    let score = 0; 
    for (const term of queryTerms) {
      const regex = new RegExp(term, 'gi');
      const matches = chunkLower.match(regex);
      if (matches) score += matches.length;
    }
    return { chunk, score };
  });
  return scoredChunks
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.chunk);
}

// app.post("/chat", async (req, res) => {
//   console.log("Received chat request:", req.body);
//   const userMessage = req.body.message;
//   const useRAG = req.body.useRAG === undefined ? true : req.body.useRAG; 
//   let messages = [];
//   let sources = [];
//   if (useRAG) {
//     await loadPDF();
//     sources = retrieveRelevantContent(userMessage);
//     if (sources.length > 0) {
//       messages.push({ 
//         role: "system", 
//         content: `You are a helpful assistant answering questions about the company based on its employee handbook. 
//         Use ONLY the following information from the handbook to answer the user's question.
//         If you can't find relevant information in the provided context, say so clearly.
//         --- EMPLOYEE HANDBOOK EXCERPTS ---
//         ${sources.join('')}
//         --- END OF EXCERPTS ---`
//       });
//     } else {
//       messages.push({
//         role: "system",
//         content: "You are a helpful assistant. No relevant information was found in the employee handbook for this question."
//       });
//     }
//   } else {
//     messages.push({
//       role: "system",
//       content: "You are a helpful assistant."
//     });
//   }
//   messages.push({ role: "user", content: userMessage });

//   // try {
//   //   console.log("Sending messages to model:", messages);
//   //   const response = await client.path("chat/completions").post({
//   //     body: {
//   //       messages,
//   //       max_tokens: 4096,
//   //       temperature: 1,
//   //       top_p: 1,
//   //       model: "Llama-4-Maverick-17B-128E-Instruct-FP8",
//   //     },
//   //   });
//   //   if (isUnexpected(response)) throw new Error(response.body.error || "Model API error");
//   //   res.json({
//   //     reply: response.body.choices[0].message.content,
//   //     sources: useRAG ? sources : []
//   //   });
//   // } catch (err) {
//   //   console.error("Model call failed:", err.message);
//   //   res.status(500).json({ error: "Model call failed", message: err.message });
//   // }

//     try {
//     const response = await chatModel.invoke(messages);
//     console.log("Model response:", response);
//     res.json({ reply: response.content });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({
//       error: "Model call failed",
//       message: err.message,
//       reply: "Sorry, I encountered an error. Please try again."
//     });
//   }
// });



// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).send(process.env.NODE_ENV === 'dev'
//     ? 'Something went wrong!'
//     : err.stack
//   );
// });

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  const useRAG = req.body.useRAG === undefined ? true : req.body.useRAG;
  const sessionId = req.body.sessionId || "default";

  let sources = [];

  const memory = getSessionMemory(sessionId);
  const memoryVars = await memory.loadMemoryVariables({});

  if (useRAG) {
    await loadPDF();
    sources = retrieveRelevantContent(userMessage);
  }

  // Prepare system prompt
  const systemMessage = useRAG
    ? {
        role: "system",
        content: sources.length > 0
          ? `You are a helpful assistant for Contoso Electronics. You must ONLY use the information provided below to answer.\n\n--- EMPLOYEE HANDBOOK EXCERPTS ---\n${sources.join('\n\n')}\n--- END OF EXCERPTS ---`
          : `You are a helpful assistant for Contoso Electronics. The excerpts do not contain relevant information for this question. Reply politely: \"I'm sorry, I don't know. The employee handbook does not contain information about that.\"`,
      }
    : {
        role: "system",
        content: "You are a helpful and knowledgeable assistant. Answer the user's questions concisely and informatively.",
      };

  try {
    // Build final messages array
    const messages = [
      systemMessage,
      ...(memoryVars.chat_history || []),
      { role: "user", content: userMessage },
    ];

    const response = await chatModel.invoke(messages);

    await memory.saveContext({ input: userMessage }, { output: response.content });

    res.json({ reply: response.content, sources });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Model call failed",
      message: err.message,
      reply: "Sorry, I encountered an error. Please try again."
    });
  }
});

const PORT = process.env.PORT || 3002;

console.log("Starting server...");
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

app.listen(PORT, () => {
  console.log(`AI API server running on port ${PORT}`);
});