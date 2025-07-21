import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import { processHSC26PDF } from "@/lib/pdf-utils";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const indexName = process.env.PINECONE_INDEX!;

    // Check if index exists
    const existingIndexes = await pinecone.listIndexes();
    const indexExists = existingIndexes.indexes?.some((index) => index.name === indexName);

    if (!indexExists) {
      return NextResponse.json({ error: `Index "${indexName}" does not exist. Please create it first using /api/create-index` }, { status: 400 });
    }

    console.log("Starting document ingestion...");

    // Process the HSC26 PDF
    const chunks = await processHSC26PDF();
    console.log(`Processing ${chunks.length} chunks for embedding...`);

    // Get the index
    const index = pinecone.index(indexName);

    // Process chunks in batches to avoid rate limits
    const batchSize = 10;
    let processedCount = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      // Create embeddings for the batch
      const embeddings = await Promise.all(
        batch.map(async (chunk) => {
          try {
            const response = await openai.embeddings.create({
              model: "text-embedding-ada-002",
              input: chunk.content,
            });
            return response.data[0].embedding;
          } catch (error) {
            console.error(`Error creating embedding for chunk ${chunk.metadata.chunk_index}:`, error);
            throw error;
          }
        })
      );

      // Prepare vectors for upsert
      const vectors = batch.map((chunk, idx) => ({
        id: `hsc26_chunk_${chunk.metadata.chunk_index}`,
        values: embeddings[idx],
        metadata: {
          content: chunk.content,
          source: chunk.metadata.source,
          chunk_index: chunk.metadata.chunk_index,
          char_count: chunk.metadata.char_count,
        },
      }));

      // Upsert to Pinecone
      await index.upsert(vectors);

      processedCount += batch.length;
      console.log(`Processed ${processedCount}/${chunks.length} chunks`);

      // Add a small delay to respect rate limits
      if (i + batchSize < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Verify the ingestion
    const stats = await index.describeIndexStats();

    return NextResponse.json({
      message: "Document ingestion completed successfully",
      chunksProcessed: chunks.length,
      indexStats: {
        totalVectors: stats.totalRecordCount,
        dimension: stats.dimension,
      },
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    return NextResponse.json(
      {
        error: "Failed to ingest document",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
