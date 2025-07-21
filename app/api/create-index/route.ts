import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const indexName = process.env.PINECONE_INDEX!;

    // Check if index already exists
    const existingIndexes = await pinecone.listIndexes();
    const indexExists = existingIndexes.indexes?.some((index) => index.name === indexName);

    if (indexExists) {
      return NextResponse.json({
        message: `Index "${indexName}" already exists.`,
        indexName,
      });
    }

    // Create the index
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
    console.log(`Waiting for index "${indexName}" to be ready...`);
    let isReady = false;
    while (!isReady) {
      try {
        const indexInfo = await pinecone.describeIndex(indexName);
        isReady = indexInfo.status?.ready === true;
        if (!isReady) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
        }
      } catch (error) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second and retry
      }
    }

    return NextResponse.json({
      message: `Index "${indexName}" created successfully and is ready.`,
      indexName,
    });
  } catch (error) {
    console.error("Create index error:", error);
    return NextResponse.json(
      {
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
