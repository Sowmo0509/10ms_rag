import { OpenAIService } from "./openai.service";
import { PineconeService } from "./pinecone.service";
import { cosineSimilarity, roundToDecimals } from "../utils/math.utils";

export interface GroundednessEvaluation {
  score: number;
  explanation: string;
  supportingEvidence: string[];
}

export interface RelevanceEvaluation {
  score: number;
  explanation: string;
  topScores: number[];
  averageScore: number;
}

export interface RAGEvaluation {
  groundedness: GroundednessEvaluation;
  relevance: RelevanceEvaluation;
  contextUsed: string[];
  retrievalMetrics: {
    totalRetrieved: number;
    aboveThreshold: number;
    averageSimilarity: number;
  };
}

export class RAGEvaluationService {
  private openaiService: OpenAIService;
  private pineconeService: PineconeService;

  constructor() {
    this.openaiService = new OpenAIService();
    this.pineconeService = new PineconeService();
  }

  /**
   * Evaluate groundedness: How well is the answer supported by the retrieved context?
   */
  async evaluateGroundedness(answer: string, contexts: string[]): Promise<GroundednessEvaluation> {
    if (contexts.length === 0) {
      return {
        score: 0,
        explanation: "No context retrieved to support the answer",
        supportingEvidence: [],
      };
    }

    try {
      // Create embeddings for answer and contexts
      const answerEmbedding = await this.openaiService.createEmbedding(answer);
      const contextEmbeddings = await this.openaiService.createEmbeddings(contexts);

      // Calculate similarity scores between answer and each context
      const similarities = contextEmbeddings.map((contextEmb) => cosineSimilarity(answerEmbedding, contextEmb));

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
        score: roundToDecimals(groundednessScore),
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
   * Evaluate relevance: How well do the retrieved documents match the query?
   */
  evaluateRelevance(searchScores: number[]): RelevanceEvaluation {
    if (searchScores.length === 0) {
      return {
        score: 0,
        explanation: "No documents retrieved",
        topScores: [],
        averageScore: 0,
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
      score: roundToDecimals(relevanceScore),
      explanation,
      topScores: topScores.map((score) => roundToDecimals(score)),
      averageScore: roundToDecimals(averageScore),
    };
  }

  /**
   * Retrieve contexts for a query and evaluate relevance
   */
  async retrieveAndEvaluateRelevance(query: string): Promise<{
    contexts: string[];
    relevanceEvaluation: RelevanceEvaluation;
    retrievalMetrics: {
      totalRetrieved: number;
      aboveThreshold: number;
      averageSimilarity: number;
    };
  }> {
    try {
      // Create embedding for the query
      const queryEmbedding = await this.openaiService.createEmbedding(query);

      // Query Pinecone
      const result = await this.pineconeService.queryVectors(queryEmbedding, 10, 0.1);

      // Evaluate relevance
      const relevanceEvaluation = this.evaluateRelevance(result.searchScores);

      return {
        contexts: result.contexts,
        relevanceEvaluation,
        retrievalMetrics: result.retrievalMetrics,
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

  /**
   * Complete RAG evaluation combining groundedness and relevance
   */
  async evaluateRAG(query: string, answer: string, contexts?: string[]): Promise<RAGEvaluation> {
    let evaluationContexts = contexts;
    let relevanceEvaluation: RelevanceEvaluation;
    let retrievalMetrics;

    // If contexts are not provided, retrieve them
    if (!contexts || contexts.length === 0) {
      console.log("📡 No contexts provided, retrieving from vector database...");
      const retrievalResult = await this.retrieveAndEvaluateRelevance(query);
      evaluationContexts = retrievalResult.contexts;
      relevanceEvaluation = retrievalResult.relevanceEvaluation;
      retrievalMetrics = retrievalResult.retrievalMetrics;
    } else {
      console.log(`📋 Using provided contexts (${contexts.length} contexts)`);
      // If contexts are provided, we can't evaluate retrieval relevance properly
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
    const groundednessEvaluation = await this.evaluateGroundedness(answer, evaluationContexts || []);

    return {
      groundedness: groundednessEvaluation,
      relevance: relevanceEvaluation,
      contextUsed: evaluationContexts?.map((c) => c.substring(0, 150) + "...") || [],
      retrievalMetrics,
    };
  }
}
