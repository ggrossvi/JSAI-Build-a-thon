import fs from "fs";
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import "dotenv/config";


const token = process.env["GITHUB_TOKEN"];
console.log(token, "token");
const endpoint = "https://models.github.ai/inference";
const modelName = "meta/Llama-3.2-11B-Vision-Instruct";

const imagePath = "contoso_layout_sketch.jpg";
const imageBuffer = fs.readFileSync(imagePath);
const imageBase64 = imageBuffer.toString("base64");

console.log("Image base64 length:", imageBase64.length);

export async function main() {

  const client = ModelClient(
    endpoint,
    new AzureKeyCredential(token),
  );

  const response = await client.path("/chat/completions").post({
    body: {
      messages: [
        { role:"system", content: "You are a helpful assistant." },
        {
            role: "user",
            content: [
              {
                type: "text",
                text: "Write the HTML and CSS for a simple webpage based on the following layout sketch.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
      ],
      temperature: 1.0,
      top_p: 1.0,
      max_tokens: 1000,
      model: modelName
    }
  });
  console.log(response);
  if (isUnexpected(response)) {
    throw response.body.error;
  }

  console.log(response.body.choices[0].message.content);
}

main().catch((err) => {
  console.error("The sample encountered an error:", err);
});