import { NextRequest, NextResponse } from "next/server";
import { ContextRetrievalService } from "@/lib/services/context-retrieval.service";
import { RAGEvaluationService, RAGEvaluation } from "@/lib/services/rag-evaluation.service";
import { OpenAIService } from "@/lib/services/openai.service";
import { getSystemPrompt } from "@/lib/utils/language.utils";
import { APIErrorHandler, Logger } from "@/lib/utils/error-handling.utils";
import { generateSessionId, prepareContextString, prepareChatMessages, ChatMessage } from "@/lib/utils/session.utils";

const contextRetrievalService = new ContextRetrievalService();
const ragEvaluationService = new RAGEvaluationService();
const openaiService = new OpenAIService();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId: providedSessionId, chatHistory = [] } = body;

    if (!message || typeof message !== "string") {
      return APIErrorHandler.handleValidationError("Message is required");
    }

    // Generate or use provided session ID
    const sessionId = providedSessionId || generateSessionId();
    Logger.info(`Processing chat request for session: ${sessionId}`);

    // Retrieve relevant context with evaluation metrics
    const { contexts, searchScores, retrievalMetrics } = await contextRetrievalService.retrieveContext(message);

    // Prepare system prompt based on language
    const systemPrompt = getSystemPrompt(message);

    // Prepare context string and messages
    const contextString = prepareContextString(contexts);
    const messages = prepareChatMessages(systemPrompt, chatHistory, message, contextString);

    // Generate response with streaming
    Logger.info("Generating streaming response...");
    const stream = (await openaiService.createChatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 1000,
      stream: true,
    })) as AsyncIterable<{ choices: Array<{ delta?: { content?: string } }> }>;

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
          Logger.info("Starting RAG evaluation...");

          const ragEvaluation: RAGEvaluation = await ragEvaluationService.evaluateRAG(message, fullResponse, contexts);

          Logger.info("RAG Evaluation Results:", {
            groundedness: ragEvaluation.groundedness.score,
            relevance: ragEvaluation.relevance.score,
            totalContexts: contexts.length,
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
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                sessionId,
                userMessage,
                assistantMessage,
                ragEvaluation,
              })}\n\n`
            )
          );
          controller.close();
        } catch (error) {
          Logger.error("Streaming error:", error);
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
    return APIErrorHandler.handleError(error, "Chat API");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Chat history is now managed on the client side with localStorage
    // This endpoint is kept for API compatibility but doesn't do server-side cleanup
    Logger.info("Chat history cleared successfully (client-side managed)");
    return NextResponse.json({ message: "Chat history cleared successfully" });
  } catch (error) {
    return APIErrorHandler.handleError(error, "Clear chat history");
  }
}
