import { Groq } from "groq-sdk";

async function getSentence(language: string, word: string): Promise<string> {
  const client = new Groq({
    apiKey: "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",
  });

  const chatCompletion = await client.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `Please provide exactly one simple and concise sentence in '${language}' 
        that includes the word '${word}'. Ensure the sentence is easy to understand
         and does not contain any extra explanations or examples.`,
      },
    ],
    model: "llama3-8b-8192",
  });
  console.log(chatCompletion.choices[0].message.content);
  return chatCompletion.choices[0].message.content ?? "";
}

getSentence("English", "technology")
  .then((sentence) => console.log("Generated sentence:", sentence))
  .catch((error) => console.error("Error:", error));
