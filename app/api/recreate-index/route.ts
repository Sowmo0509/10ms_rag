import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const indexName = process.env.PINECONE_INDEX!;
    console.log(`🔄 Recreating index: ${indexName}`);

    // Check if index exists
    const existingIndexes = await pinecone.listIndexes();
    const indexExists = existingIndexes.indexes?.some((index) => index.name === indexName);

    if (indexExists) {
      console.log(`🗑️ Deleting existing index: ${indexName}`);
      await pinecone.deleteIndex(indexName);

      // Wait for deletion to complete
      console.log("⏳ Waiting for index deletion to complete...");
      let deleted = false;
      let attempts = 0;
      while (!deleted && attempts < 30) {
        // Max 30 attempts (5 minutes)
        try {
          const indexes = await pinecone.listIndexes();
          deleted = !indexes.indexes?.some((index) => index.name === indexName);
          if (!deleted) {
            await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
            attempts++;
          }
        } catch (error) {
          // If we can't list indexes, assume deletion is in progress
          await new Promise((resolve) => setTimeout(resolve, 10000));
          attempts++;
        }
      }

      if (!deleted) {
        throw new Error("Index deletion timed out");
      }

      console.log("✅ Index deleted successfully");
    }

    // Create the new index with correct dimensions
    console.log(`🏗️ Creating new index with 1536 dimensions...`);
    await pinecone.createIndex({
      name: indexName,
      dimension: 1536, // OpenAI text-embedding-ada-002 dimensions
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });

    // Wait for the index to be ready
    console.log(`⏳ Waiting for index "${indexName}" to be ready...`);
    let isReady = false;
    let attempts = 0;
    while (!isReady && attempts < 60) {
      // Max 60 attempts (10 minutes)
      try {
        const indexInfo = await pinecone.describeIndex(indexName);
        isReady = indexInfo.status?.ready === true;
        if (!isReady) {
          await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
          attempts++;
        }
      } catch (error) {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds and retry
        attempts++;
      }
    }

    if (!isReady) {
      throw new Error("Index creation timed out");
    }

    console.log("🎉 Index recreated successfully with correct dimensions!");

    return NextResponse.json({
      message: `Index "${indexName}" recreated successfully with 1536 dimensions and is ready.`,
      indexName,
      dimension: 1536,
    });
  } catch (error) {
    console.error("❌ Recreate index error:", error);
    return NextResponse.json(
      {
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
