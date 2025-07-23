import { Pinecone } from "@pinecone-database/pinecone";

export interface PineconeQueryResult {
  contexts: string[];
  searchScores: number[];
  retrievalMetrics: {
    totalRetrieved: number;
    aboveThreshold: number;
    averageSimilarity: number;
  };
}

export interface PineconeVector {
  id: string;
  values: number[];
  metadata: {
    content: string;
    source: string;
    chunk_index: number;
    char_count: number;
  };
}

export class PineconeService {
  private pinecone: Pinecone;
  private indexName: string;

  constructor() {
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
    this.indexName = process.env.PINECONE_INDEX!;
  }

  async checkIndexExists(): Promise<boolean> {
    try {
      const existingIndexes = await this.pinecone.listIndexes();
      return existingIndexes.indexes?.some((index) => index.name === this.indexName) || false;
    } catch (error) {
      console.error("Error checking Pinecone index:", error);
      throw new Error(`Failed to check Pinecone index: ${(error as Error).message}`);
    }
  }

  async queryVectors(vector: number[], topK: number = 10, threshold: number = 0.1): Promise<PineconeQueryResult> {
    try {
      const index = this.pinecone.index(this.indexName);

      const searchResults = await index.query({
        vector,
        topK,
        includeMetadata: true,
      });

      const allScores = searchResults.matches?.map((m) => m.score || 0) || [];

      // Extract contexts above threshold
      const contexts =
        searchResults.matches
          ?.filter((match) => match.score && match.score > threshold)
          .map((match) => match.metadata?.content as string)
          .filter((content) => content && content.length > 0) || [];

      const relevantScores = searchResults.matches?.filter((match) => match.score && match.score > threshold).map((match) => match.score || 0) || [];

      // Calculate retrieval metrics
      const totalRetrieved = searchResults.matches?.length || 0;
      const aboveThreshold = contexts.length;
      const averageSimilarity = allScores.length > 0 ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length : 0;

      return {
        contexts,
        searchScores: relevantScores,
        retrievalMetrics: {
          totalRetrieved,
          aboveThreshold,
          averageSimilarity: Math.round(averageSimilarity * 100) / 100,
        },
      };
    } catch (error) {
      console.error("Error querying Pinecone:", error);
      throw new Error(`Failed to query Pinecone: ${(error as Error).message}`);
    }
  }

  async upsertVectors(vectors: PineconeVector[]): Promise<void> {
    try {
      const index = this.pinecone.index(this.indexName);
      await index.upsert(vectors);
    } catch (error) {
      console.error("Error upserting to Pinecone:", error);
      throw new Error(`Failed to upsert to Pinecone: ${(error as Error).message}`);
    }
  }

  async getIndexStats(): Promise<{
    totalRecordCount?: number;
    dimension?: number;
    [key: string]: unknown;
  }> {
    try {
      const index = this.pinecone.index(this.indexName);
      return await index.describeIndexStats();
    } catch (error) {
      console.error("Error getting index stats:", error);
      throw new Error(`Failed to get index stats: ${(error as Error).message}`);
    }
  }

  getIndexName(): string {
    return this.indexName;
  }
}
