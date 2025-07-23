import { OpenAIService } from "./openai.service";
import { PineconeService, PineconeQueryResult } from "./pinecone.service";
import { isBengali, extractBengaliKeywords } from "../utils/language.utils";

export class ContextRetrievalService {
  private openaiService: OpenAIService;
  private pineconeService: PineconeService;

  constructor() {
    this.openaiService = new OpenAIService();
    this.pineconeService = new PineconeService();
  }

  /**
   * Retrieve relevant context from Pinecone with keyword fallback for Bengali
   */
  async retrieveContext(query: string, topK: number = 10): Promise<PineconeQueryResult> {
    try {
      console.log(`🔍 Retrieving context for query: "${query}"`);

      // Create embedding for the query
      console.log("📊 Creating embedding for query...");
      const queryEmbedding = await this.openaiService.createEmbedding(query);
      console.log(`✅ Query embedding created: ${queryEmbedding.length} dimensions`);

      // Search for similar vectors
      console.log(`🔎 Searching Pinecone for top ${topK} matches...`);
      const result = await this.pineconeService.queryVectors(queryEmbedding, topK, 0.1);

      console.log(`📋 Search results: ${result.contexts.length} contexts found`);
      console.log(`✅ Retrieved ${result.contexts.length} relevant contexts using semantic search`);

      // If no contexts found or very few, try keyword-based fallback for Bengali queries
      if (result.contexts.length < 2 && isBengali(query)) {
        console.log("🔄 Trying keyword-based fallback for Bengali query...");

        const enhancedResult = await this.performBengaliKeywordFallback(query, queryEmbedding, topK);
        if (enhancedResult.contexts.length > result.contexts.length) {
          console.log(`✅ Keyword fallback improved results: ${enhancedResult.contexts.length} total contexts`);
          return enhancedResult;
        }
      }

      if (result.contexts.length > 0) {
        console.log(`📄 Sample context: "${result.contexts[0].substring(0, 100)}..."`);
        // Log all retrieved contexts for debugging
        result.contexts.forEach((context, index) => {
          console.log(`📄 Context ${index + 1}: "${context.substring(0, 150)}..."`);
        });
      } else {
        console.log("❌ No contexts retrieved");
      }

      return result;
    } catch (error) {
      console.error("❌ Error retrieving context:", error);
      return {
        contexts: [],
        searchScores: [],
        retrievalMetrics: {
          totalRetrieved: 0,
          aboveThreshold: 0,
          averageSimilarity: 0,
        },
      };
    }
  }

  /**
   * Perform Bengali keyword-based fallback search
   */
  private async performBengaliKeywordFallback(query: string, queryEmbedding: number[], topK: number): Promise<PineconeQueryResult> {
    try {
      // Extract key Bengali words from the query
      const bengaliWords = extractBengaliKeywords(query);
      console.log(`🔤 Bengali keywords found: ${bengaliWords.join(", ")}`);

      // Get broader search results for keyword matching
      const broadResult = await this.pineconeService.queryVectors(queryEmbedding, topK * 2, 0.05);

      // Find keyword matches in the broader results
      const keywordMatches = broadResult.contexts.filter((context) => {
        return bengaliWords.some((word) => context.includes(word));
      });

      if (keywordMatches.length > 0) {
        console.log(`🎯 Found ${keywordMatches.length} keyword matches`);

        // Combine with original semantic results, removing duplicates
        const combinedContexts = Array.from(new Set([...broadResult.contexts, ...keywordMatches]));

        return {
          contexts: combinedContexts,
          searchScores: broadResult.searchScores,
          retrievalMetrics: {
            ...broadResult.retrievalMetrics,
            aboveThreshold: combinedContexts.length,
          },
        };
      }

      return broadResult;
    } catch (error) {
      console.error("Error in Bengali keyword fallback:", error);
      return {
        contexts: [],
        searchScores: [],
        retrievalMetrics: {
          totalRetrieved: 0,
          aboveThreshold: 0,
          averageSimilarity: 0,
        },
      };
    }
  }
}
