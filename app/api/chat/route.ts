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

interface RAGEvaluation {
  groundedness: {
    score: number;
    explanation: string;
    supportingEvidence: string[];
  };
  relevance: {
    score: number;
    explanation: string;
    topScores: number[];
    averageScore: number;
  };
  contextUsed: string[];
  retrievalMetrics: {
    totalRetrieved: number;
    aboveThreshold: number;
    averageSimilarity: number;
  };
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Evaluate groundedness: How well is the answer supported by the retrieved context?
 */
async function evaluateGroundedness(answer: string, contexts: string[]): Promise<{
  score: number;
  explanation: string;
  supportingEvidence: string[];
}> {
  if (contexts.length === 0) {
    return {
      score: 0,
      explanation: "No context retrieved to support the answer",
      supportingEvidence: []
    };
  }

  try {
    // Create embeddings for answer and contexts
    const answerEmbedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: answer,
    });

    const contextEmbeddings = await Promise.all(
      contexts.map(context => 
        openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: context,
        })
      )
    );

    // Calculate similarity scores between answer and each context
    const similarities = contextEmbeddings.map(contextEmb => 
      cosineSimilarity(answerEmbedding.data[0].embedding, contextEmb.data[0].embedding)
    );

    // Find the best supporting contexts (similarity > 0.7)
    const supportingEvidence: string[] = [];
    const highSimilarityIndices = similarities
      .map((sim, idx) => ({ sim, idx }))
      .filter(item => item.sim > 0.7)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 3); // Top 3 supporting contexts

    highSimilarityIndices.forEach(item => {
      supportingEvidence.push(contexts[item.idx].substring(0, 200) + "...");
    });

    // Calculate overall groundedness score
    const maxSimilarity = Math.max(...similarities);
    const avgTopSimilarities = similarities
      .sort((a, b) => b - a)
      .slice(0, Math.min(3, similarities.length))
      .reduce((sum, sim) => sum + sim, 0) / Math.min(3, similarities.length);

    const groundednessScore = Math.min(1, avgTopSimilarities * 1.2); // Boost good scores slightly

    let explanation = "";
    if (groundednessScore >= 0.8) {
      explanation = "Excellent: Answer is strongly supported by retrieved context";
    } else if (groundednessScore >= 0.6) {
      explanation = "Good: Answer has reasonable support from context";
    } else if (groundednessScore >= 0.4) {
      explanation = "Fair: Answer has some support but may include unsupported information";
    } else {
      explanation = "Poor: Answer appears to have limited support from retrieved context";
    }

    return {
      score: Math.round(groundednessScore * 100) / 100,
      explanation,
      supportingEvidence
    };

  } catch (error) {
    console.error("Error evaluating groundedness:", error);
    return {
      score: 0,
      explanation: "Error calculating groundedness score",
      supportingEvidence: []
    };
  }
}

/**
 * Evaluate relevance: How well do the retrieved documents match the query?
 */
function evaluateRelevance(searchScores: number[]): {
  score: number;
  explanation: string;
  topScores: number[];
  averageScore: number;
} {
  if (searchScores.length === 0) {
    return {
      score: 0,
      explanation: "No documents retrieved",
      topScores: [],
      averageScore: 0
    };
  }

  const topScores = searchScores.slice(0, 5); // Top 5 scores
  const averageScore = searchScores.reduce((sum, score) => sum + score, 0) / searchScores.length;
  const topAverage = topScores.reduce((sum, score) => sum + score, 0) / topScores.length;

  // Relevance score based on top results
  const relevanceScore = Math.min(1, topAverage * 1.1); // Slight boost for good retrieval

  let explanation = "";
  if (relevanceScore >= 0.8) {
    explanation = "Excellent: Retrieved documents are highly relevant to the query";
  } else if (relevanceScore >= 0.6) {
    explanation = "Good: Retrieved documents are reasonably relevant";
  } else if (relevanceScore >= 0.4) {
    explanation = "Fair: Some retrieved documents are relevant but quality varies";
  } else {
    explanation = "Poor: Retrieved documents have low relevance to the query";
  }

  return {
    score: Math.round(relevanceScore * 100) / 100,
    explanation,
    topScores: topScores.map(score => Math.round(score * 100) / 100),
    averageScore: Math.round(averageScore * 100) / 100
  };
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
 * Retrieve relevant context from Pinecone with keyword fallback for Bengali
 */
async function retrieveContext(query: string, topK: number = 10): Promise<{
  contexts: string[];
  searchScores: number[];
  retrievalMetrics: {
    totalRetrieved: number;
    aboveThreshold: number;
    averageSimilarity: number;
  };
}> {
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
    
    const allScores = searchResults.matches?.map(m => m.score || 0) || [];
    
    if (searchResults.matches && searchResults.matches.length > 0) {
      console.log(
        "🎯 Match scores:",
        searchResults.matches.map((m) => ({ id: m.id, score: m.score }))
      );
    }

    // Extract content from results - Very low threshold for Bengali text + detailed logging
    let contexts =
      searchResults.matches
        ?.filter((match) => match.score && match.score > 0.1) // Very low threshold for Bengali text
        .map((match) => match.metadata?.content as string)
        .filter((content) => content && content.length > 0) || [];

    const relevantScores = searchResults.matches
      ?.filter((match) => match.score && match.score > 0.1)
      .map(match => match.score || 0) || [];

    console.log(`✅ Retrieved ${contexts.length} relevant contexts using semantic search`);

    // If no contexts found or very few, try keyword-based fallback for Bengali queries
    if (contexts.length < 2 && isBengali(query)) {
      console.log("🔄 Trying keyword-based fallback for Bengali query...");

      // Extract key Bengali words from the query
      const bengaliWords = query.match(/[\u0980-\u09FF]+/g) || [];
      console.log(`🔤 Bengali keywords found: ${bengaliWords.join(", ")}`);

      // Get all matches and search for keyword matches
      const allMatches = searchResults.matches || [];
      const keywordMatches = allMatches.filter((match) => {
        const content = match.metadata?.content as string;
        if (!content) return false;

        // Check if any Bengali keyword appears in the content
        return bengaliWords.some((word) => content.includes(word));
      });

      if (keywordMatches.length > 0) {
        console.log(`🎯 Found ${keywordMatches.length} keyword matches`);
        const keywordContexts = keywordMatches.map((match) => match.metadata?.content as string).filter((content) => content && content.length > 0);
        const keywordScores = keywordMatches.map(match => match.score || 0);

        // Merge with semantic results, removing duplicates
        const allContexts = [...contexts, ...keywordContexts];
        contexts = Array.from(new Set(allContexts)); // Remove duplicates
        relevantScores.push(...keywordScores);
        console.log(`✅ Combined contexts: ${contexts.length} total`);
      }
    }

    // Calculate retrieval metrics
    const totalRetrieved = searchResults.matches?.length || 0;
    const aboveThreshold = contexts.length;
    const averageSimilarity = allScores.length > 0 ? 
      allScores.reduce((sum, score) => sum + score, 0) / allScores.length : 0;

    if (contexts.length > 0) {
      console.log(`📄 Sample context: "${contexts[0].substring(0, 100)}..."`);
      // Log all retrieved contexts for debugging
      contexts.forEach((context, index) => {
        console.log(`📄 Context ${index + 1}: "${context.substring(0, 150)}..."`);
      });
    } else {
      console.log("❌ No contexts retrieved - showing all matches for debugging:");
      searchResults.matches?.forEach((match, index) => {
        console.log(`🔍 Match ${index + 1}: score=${match.score}, content="${(match.metadata?.content as string)?.substring(0, 100)}..."`);
      });
    }

    return {
      contexts,
      searchScores: relevantScores,
      retrievalMetrics: {
        totalRetrieved,
        aboveThreshold,
        averageSimilarity: Math.round(averageSimilarity * 100) / 100
      }
    };
  } catch (error) {
    console.error("❌ Error retrieving context:", error);
    return {
      contexts: [],
      searchScores: [],
      retrievalMetrics: {
        totalRetrieved: 0,
        aboveThreshold: 0,
        averageSimilarity: 0
      }
    };
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

    // Retrieve relevant context with evaluation metrics
    const { contexts, searchScores, retrievalMetrics } = await retrieveContext(message);

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

          // Evaluate the RAG system performance
          console.log("🔬 Starting RAG evaluation...");
          
          // Evaluate groundedness
          const groundednessEval = await evaluateGroundedness(fullResponse, contexts);
          
          // Evaluate relevance
          const relevanceEval = evaluateRelevance(searchScores);
          
          const ragEvaluation: RAGEvaluation = {
            groundedness: groundednessEval,
            relevance: relevanceEval,
            contextUsed: contexts.map(c => c.substring(0, 150) + "..."),
            retrievalMetrics
          };

          console.log("📊 RAG Evaluation Results:", {
            groundedness: ragEvaluation.groundedness.score,
            relevance: ragEvaluation.relevance.score,
            totalContexts: contexts.length
          });

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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            done: true, 
            sessionId, 
            userMessage, 
            assistantMessage,
            ragEvaluation 
          })}\n\n`));
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
