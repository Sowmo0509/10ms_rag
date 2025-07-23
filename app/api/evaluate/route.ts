import { NextRequest, NextResponse } from "next/server";
import { RAGEvaluationService, RAGEvaluation } from "@/lib/services/rag-evaluation.service";
import { APIErrorHandler, Logger } from "@/lib/utils/error-handling.utils";

const ragEvaluationService = new RAGEvaluationService();

interface EvaluationRequest {
  query: string;
  answer: string;
  contexts?: string[];
}

interface EvaluationResponse extends RAGEvaluation {
  metadata: {
    evaluatedAt: string;
    queryLength: number;
    answerLength: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: EvaluationRequest = await req.json();
    const { query, answer, contexts } = body;

    if (!query || !answer) {
      return APIErrorHandler.handleValidationError("Both query and answer are required");
    }

    Logger.info(`🔬 Evaluating RAG performance for query: "${query.substring(0, 100)}..."`);

    // Perform complete RAG evaluation
    const ragEvaluation = await ragEvaluationService.evaluateRAG(query, answer, contexts);

    const response: EvaluationResponse = {
      ...ragEvaluation,
      metadata: {
        evaluatedAt: new Date().toISOString(),
        queryLength: query.length,
        answerLength: answer.length,
      },
    };

    Logger.info("📊 Evaluation completed:", {
      groundedness: response.groundedness.score,
      relevance: response.relevance.score,
      contextsUsed: response.contextUsed.length,
    });

    return NextResponse.json(response);
  } catch (error) {
    return APIErrorHandler.handleError(error, "Evaluation API");
  }
}

// GET endpoint for evaluation examples and documentation
export async function GET() {
  const examples = {
    description: "RAG Evaluation API - Evaluate groundedness and relevance of question-answer pairs",
    endpoints: {
      "POST /api/evaluate": {
        description: "Evaluate a query-answer pair for groundedness and relevance",
        parameters: {
          query: "The user's question (required)",
          answer: "The system's response (required)",
          contexts: "Array of context strings (optional - if not provided, will be retrieved)",
        },
        example: {
          query: "অনুপমের ভাষায় সুপুরুষ কাকে বলা হয়েছে?",
          answer: "অনুপমের ভাষায় সুপুরুষ বলা হয়েছে তাকে যে...",
          contexts: ["context1", "context2"], // optional
        },
      },
    },
    metrics: {
      groundedness: {
        description: "Measures how well the answer is supported by retrieved context",
        range: "0.0 to 1.0",
        calculation: "Cosine similarity between answer and context embeddings",
      },
      relevance: {
        description: "Measures how well retrieved documents match the query",
        range: "0.0 to 1.0",
        calculation: "Average of top similarity scores from vector search",
      },
    },
    scoringGuidelines: {
      excellent: "0.8 - 1.0",
      good: "0.6 - 0.8",
      fair: "0.4 - 0.6",
      poor: "0.0 - 0.4",
    },
  };

  return NextResponse.json(examples);
}
