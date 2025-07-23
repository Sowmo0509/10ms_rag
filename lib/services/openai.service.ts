import OpenAI from "openai";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  async createEmbedding(input: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-ada-002",
        input,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error("Error creating embedding:", error);
      throw new Error(`Failed to create embedding: ${(error as Error).message}`);
    }
  }

  async createEmbeddings(inputs: string[]): Promise<number[][]> {
    try {
      const embeddings = await Promise.all(
        inputs.map(async (input, index) => {
          console.log(`Creating embedding ${index + 1}/${inputs.length}`);
          const response = await this.openai.embeddings.create({
            model: "text-embedding-ada-002",
            input,
          });
          return response.data[0].embedding;
        })
      );
      return embeddings;
    } catch (error) {
      console.error("Error creating embeddings:", error);
      throw new Error(`Failed to create embeddings: ${(error as Error).message}`);
    }
  }

  async createChatCompletion(
    messages: ChatMessage[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    } = {}
  ): Promise<OpenAI.Chat.Completions.ChatCompletion | AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    try {
      const { model = "gpt-4o-mini", temperature = 0.7, maxTokens = 1000, stream = false } = options;

      return await this.openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream,
      });
    } catch (error) {
      console.error("Error creating chat completion:", error);
      throw new Error(`Failed to create chat completion: ${(error as Error).message}`);
    }
  }
}
