import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

/**
 * Detect if text is primarily Bengali
 */
function isBengali(text: string): boolean {
  const bengaliChars = text.match(/[\u0980-\u09FF]/g);
  const totalChars = text.replace(/\s/g, "").length;
  return bengaliChars ? bengaliChars.length / totalChars > 0.3 : false;
}

/**
 * Retrieve relevant context from Pinecone
 */
async function retrieveContext(query: string, topK: number = 5): Promise<string[]> {
  try {
    console.log(`🔍 Retrieving context for query: "${query}"`);
    const indexName = process.env.PINECONE_INDEX!;
    const index = pinecone.index(indexName);

    // Create embedding for the query
    console.log("📊 Creating embedding for query...");
    const queryEmbedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });
    console.log(`✅ Query embedding created: ${queryEmbedding.data[0].embedding.length} dimensions`);

    // Search for similar vectors
    console.log(`🔎 Searching Pinecone for top ${topK} matches...`);
    const searchResults = await index.query({
      vector: queryEmbedding.data[0].embedding,
      topK,
      includeMetadata: true,
    });

    console.log(`📋 Search results: ${searchResults.matches?.length || 0} matches found`);
    if (searchResults.matches && searchResults.matches.length > 0) {
      console.log(
        "🎯 Match scores:",
        searchResults.matches.map((m) => ({ id: m.id, score: m.score }))
      );
    }

    // Extract content from results - Lower the threshold to 0.5 for better retrieval
    const contexts =
      searchResults.matches
        ?.filter((match) => match.score && match.score > 0.5) // Lower threshold for better retrieval
        .map((match) => match.metadata?.content as string)
        .filter((content) => content && content.length > 0) || [];

    console.log(`✅ Retrieved ${contexts.length} relevant contexts`);
    if (contexts.length > 0) {
      console.log(`📄 Sample context: "${contexts[0].substring(0, 100)}..."`);
    }

    return contexts;
  } catch (error) {
    console.error("❌ Error retrieving context:", error);
    return [];
  }
}

/**
 * Generate chat session ID
 */
function generateSessionId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Chat history is now handled on the client side with localStorage
// No server-side storage needed

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId: providedSessionId, chatHistory = [] } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Generate or use provided session ID
    const sessionId = providedSessionId || generateSessionId();

    // Detect language
    const isUserBengali = isBengali(message);

    // Retrieve relevant context
    const contexts = await retrieveContext(message);

    // Prepare system prompt based on language
    const systemPrompt = isUserBengali ? `আপনি একটি সহায়ক AI সহায়ক। আপনাকে দেওয়া প্রসঙ্গের ভিত্তিতে প্রশ্নের উত্তর দিন। যদি প্রসঙ্গে উত্তর না থাকে, তাহলে বিনয়ের সাথে বলুন যে আপনি জানেন না। সবসময় বাংলায় উত্তর দিন।` : `You are a helpful AI assistant. Answer questions based on the provided context. If the answer is not in the context, politely say you don't know. Always respond in English.`;

    // Prepare context string
    const contextString = contexts.length > 0 ? `Context information:\n${contexts.join("\n\n")}\n\n` : "";

    // Prepare messages for OpenAI
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...chatHistory.slice(-10).map((msg: ChatMessage) => ({ role: msg.role, content: msg.content })), // Include recent history
      { role: "user", content: `${contextString}Question: ${message}` },
    ];

    // Generate response with streaming
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
    });

    // Create readable stream
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = "";

          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              fullResponse += content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content, sessionId })}\n\n`));
            }
          }

          // Save to chat history
          const userMessage: ChatMessage = {
            role: "user",
            content: message,
            timestamp: Date.now(),
          };

          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: fullResponse,
            timestamp: Date.now(),
          };

          // Chat history is now managed on the client side
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, sessionId, userMessage, assistantMessage })}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Failed to process chat request", details: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Chat history is now managed on the client side with localStorage
    // This endpoint is kept for API compatibility but doesn't do server-side cleanup
    return NextResponse.json({ message: "Chat history cleared successfully" });
  } catch (error) {
    console.error("Error clearing chat history:", error);
    return NextResponse.json({ error: "Failed to clear chat history" }, { status: 500 });
  }
}
