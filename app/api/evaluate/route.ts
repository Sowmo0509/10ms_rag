import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface EvaluationRequest {
  query: string;
  answer: string;
  contexts?: string[];
}

interface EvaluationResponse {
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
  metadata: {
    evaluatedAt: string;
    queryLength: number;
    answerLength: number;
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
async function evaluateGroundedness(
  answer: string,
  contexts: string[]
): Promise<{
  score: number;
  explanation: string;
  supportingEvidence: string[];
}> {
  if (contexts.length === 0) {
    return {
      score: 0,
      explanation: "No context retrieved to support the answer",
      supportingEvidence: [],
    };
  }

  try {
    // Create embeddings for answer and contexts
    const answerEmbedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: answer,
    });

    const contextEmbeddings = await Promise.all(
      contexts.map((context) =>
        openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: context,
        })
      )
    );

    // Calculate similarity scores between answer and each context
    const similarities = contextEmbeddings.map((contextEmb) => cosineSimilarity(answerEmbedding.data[0].embedding, contextEmb.data[0].embedding));

    // Find the best supporting contexts (similarity > 0.7)
    const supportingEvidence: string[] = [];
    const highSimilarityIndices = similarities
      .map((sim, idx) => ({ sim, idx }))
      .filter((item) => item.sim > 0.7)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 3); // Top 3 supporting contexts

    highSimilarityIndices.forEach((item) => {
      supportingEvidence.push(contexts[item.idx].substring(0, 200) + "...");
    });

    // Calculate overall groundedness score
    const avgTopSimilarities =
      similarities
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
      supportingEvidence,
    };
  } catch (error) {
    console.error("Error evaluating groundedness:", error);
    return {
      score: 0,
      explanation: "Error calculating groundedness score",
      supportingEvidence: [],
    };
  }
}

/**
 * Retrieve contexts for a query and return relevance evaluation
 */
async function retrieveAndEvaluateRelevance(query: string): Promise<{
  contexts: string[];
  relevanceEvaluation: {
    score: number;
    explanation: string;
    topScores: number[];
    averageScore: number;
  };
  retrievalMetrics: {
    totalRetrieved: number;
    aboveThreshold: number;
    averageSimilarity: number;
  };
}> {
  try {
    const indexName = process.env.PINECONE_INDEX!;
    const index = pinecone.index(indexName);

    // Create embedding for the query
    const queryEmbedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });

    // Search for similar vectors
    const searchResults = await index.query({
      vector: queryEmbedding.data[0].embedding,
      topK: 10,
      includeMetadata: true,
    });

    const allScores = searchResults.matches?.map((m) => m.score || 0) || [];

    // Extract contexts above threshold
    const contexts =
      searchResults.matches
        ?.filter((match) => match.score && match.score > 0.1)
        .map((match) => match.metadata?.content as string)
        .filter((content) => content && content.length > 0) || [];

    const relevantScores = searchResults.matches?.filter((match) => match.score && match.score > 0.1).map((match) => match.score || 0) || [];

    // Calculate relevance evaluation
    const topScores = relevantScores.slice(0, 5);
    const averageScore = relevantScores.length > 0 ? relevantScores.reduce((sum, score) => sum + score, 0) / relevantScores.length : 0;
    const topAverage = topScores.length > 0 ? topScores.reduce((sum, score) => sum + score, 0) / topScores.length : 0;

    const relevanceScore = Math.min(1, topAverage * 1.1);

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

    // Calculate retrieval metrics
    const totalRetrieved = searchResults.matches?.length || 0;
    const aboveThreshold = contexts.length;
    const overallAverageSimilarity = allScores.length > 0 ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length : 0;

    return {
      contexts,
      relevanceEvaluation: {
        score: Math.round(relevanceScore * 100) / 100,
        explanation,
        topScores: topScores.map((score) => Math.round(score * 100) / 100),
        averageScore: Math.round(averageScore * 100) / 100,
      },
      retrievalMetrics: {
        totalRetrieved,
        aboveThreshold,
        averageSimilarity: Math.round(overallAverageSimilarity * 100) / 100,
      },
    };
  } catch (error) {
    console.error("Error retrieving and evaluating relevance:", error);
    return {
      contexts: [],
      relevanceEvaluation: {
        score: 0,
        explanation: "Error retrieving contexts for relevance evaluation",
        topScores: [],
        averageScore: 0,
      },
      retrievalMetrics: {
        totalRetrieved: 0,
        aboveThreshold: 0,
        averageSimilarity: 0,
      },
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: EvaluationRequest = await req.json();
    const { query, answer, contexts } = body;

    if (!query || !answer) {
      return NextResponse.json({ error: "Both query and answer are required" }, { status: 400 });
    }

    console.log(`🔬 Evaluating RAG performance for query: "${query.substring(0, 100)}..."`);

    let evaluationContexts = contexts;
    let relevanceEvaluation;
    let retrievalMetrics;

    // If contexts are not provided, retrieve them
    if (!contexts || contexts.length === 0) {
      console.log("📡 No contexts provided, retrieving from vector database...");
      const retrievalResult = await retrieveAndEvaluateRelevance(query);
      evaluationContexts = retrievalResult.contexts;
      relevanceEvaluation = retrievalResult.relevanceEvaluation;
      retrievalMetrics = retrievalResult.retrievalMetrics;
    } else {
      console.log(`📋 Using provided contexts (${contexts.length} contexts)`);
      // If contexts are provided, we can't evaluate retrieval relevance properly
      // So we'll create a basic relevance evaluation
      relevanceEvaluation = {
        score: 1.0, // Assume perfect relevance since contexts were manually provided
        explanation: "Contexts were manually provided - cannot evaluate retrieval relevance",
        topScores: [],
        averageScore: 1.0,
      };
      retrievalMetrics = {
        totalRetrieved: contexts.length,
        aboveThreshold: contexts.length,
        averageSimilarity: 1.0,
      };
    }

    // Evaluate groundedness
    console.log("🎯 Evaluating groundedness...");
    const groundednessEvaluation = await evaluateGroundedness(answer, evaluationContexts || []);

    const response: EvaluationResponse = {
      groundedness: groundednessEvaluation,
      relevance: relevanceEvaluation,
      contextUsed: evaluationContexts?.map((c) => c.substring(0, 150) + "...") || [],
      retrievalMetrics,
      metadata: {
        evaluatedAt: new Date().toISOString(),
        queryLength: query.length,
        answerLength: answer.length,
      },
    };

    console.log("📊 Evaluation completed:", {
      groundedness: response.groundedness.score,
      relevance: response.relevance.score,
      contextsUsed: response.contextUsed.length,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Evaluation API error:", error);
    return NextResponse.json(
      {
        error: "Failed to evaluate RAG performance",
        details: (error as Error).message,
      },
      { status: 500 }
    );
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
