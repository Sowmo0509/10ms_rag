import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import { processHSC26PDF, PageRange } from "@/lib/pdf-utils";
import { ACTIVE_PAGE_CONFIG } from "@/config/pdf-pages";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  console.log("=== INGESTION API CALLED ===");

  try {
    const indexName = process.env.PINECONE_INDEX;
    console.log("Environment check - PINECONE_INDEX:", indexName ? "✓ Set" : "✗ Missing");
    console.log("Environment check - OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✓ Set" : "✗ Missing");
    console.log("Environment check - PINECONE_API_KEY:", process.env.PINECONE_API_KEY ? "✓ Set" : "✗ Missing");

    if (!indexName) {
      console.error("PINECONE_INDEX environment variable is not set");
      return NextResponse.json({ error: "PINECONE_INDEX environment variable is not set" }, { status: 500 });
    }

    // Parse request body for optional page ranges, or use config file
    let pageRanges: PageRange[] | undefined;
    try {
      const body = await req.json();
      pageRanges = body.pageRanges || (ACTIVE_PAGE_CONFIG.length > 0 ? ACTIVE_PAGE_CONFIG : undefined);
      console.log("Request body parsed successfully");
    } catch (error) {
      // If no body or invalid JSON, use config file or all pages
      pageRanges = ACTIVE_PAGE_CONFIG.length > 0 ? ACTIVE_PAGE_CONFIG : undefined;
      console.log("No request body, using config file or all pages");
    }

    console.log("Page ranges configuration:", pageRanges || "All pages");

    // Check if index exists
    console.log("Checking if Pinecone index exists...");
    try {
      const existingIndexes = await pinecone.listIndexes();
      const indexExists = existingIndexes.indexes?.some((index) => index.name === indexName);
      console.log("Index check result:", indexExists ? "✓ Exists" : "✗ Not found");

      if (!indexExists) {
        console.error(`Index "${indexName}" does not exist`);
        return NextResponse.json({ error: `Index "${indexName}" does not exist. Please create it first using /api/create-index` }, { status: 400 });
      }
    } catch (indexError) {
      console.error("Error checking Pinecone index:", indexError);
      return NextResponse.json({ error: `Failed to check Pinecone index: ${(indexError as Error).message}` }, { status: 500 });
    }

    console.log("✓ Starting document ingestion...");
    if (pageRanges && pageRanges.length > 0) {
      console.log("✓ Page ranges specified:", pageRanges);
    }

    // Process the HSC26 PDF with optional page ranges
    console.log("Processing HSC26 PDF...");
    let chunks;
    try {
      chunks = await processHSC26PDF(pageRanges);
      console.log(`✓ PDF processing complete: ${chunks.length} chunks created`);
    } catch (pdfError) {
      console.error("Error processing PDF:", pdfError);
      return NextResponse.json({ error: `Failed to process PDF: ${(pdfError as Error).message}` }, { status: 500 });
    }

    // Get the index
    console.log("Initializing Pinecone index connection...");
    let index;
    try {
      index = pinecone.index(indexName);
      console.log("✓ Pinecone index connection established");
    } catch (indexError) {
      console.error("Error connecting to Pinecone index:", indexError);
      return NextResponse.json({ error: `Failed to connect to Pinecone index: ${(indexError as Error).message}` }, { status: 500 });
    }

    // Process chunks in batches to avoid rate limits
    const batchSize = 10;
    let processedCount = 0;
    console.log(`Starting batch processing: ${chunks.length} chunks, batch size: ${batchSize}`);

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} (${batch.length} chunks)`);

      // Create embeddings for the batch
      console.log("Creating embeddings...");
      let embeddings;
      try {
        embeddings = await Promise.all(
          batch.map(async (chunk, batchIdx) => {
            try {
              console.log(`  - Creating embedding for chunk ${chunk.metadata.chunk_index} (${chunk.content.length} chars)`);
              const response = await openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: chunk.content,
              });
              console.log(`  ✓ Embedding created for chunk ${chunk.metadata.chunk_index}`);
              return response.data[0].embedding;
            } catch (error) {
              console.error(`  ✗ Error creating embedding for chunk ${chunk.metadata.chunk_index}:`, error);
              throw error;
            }
          })
        );
        console.log(`✓ All embeddings created for batch (${embeddings.length} embeddings)`);
      } catch (embeddingError) {
        console.error("Error creating embeddings:", embeddingError);
        return NextResponse.json({ error: `Failed to create embeddings: ${(embeddingError as Error).message}` }, { status: 500 });
      }

      // Prepare vectors for upsert
      console.log("Preparing vectors for Pinecone upsert...");
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
      console.log(`✓ ${vectors.length} vectors prepared`);

      // Upsert to Pinecone
      console.log("Upserting vectors to Pinecone...");
      try {
        await index.upsert(vectors);
        console.log(`✓ Batch upserted successfully`);
      } catch (upsertError) {
        console.error("Error upserting to Pinecone:", upsertError);
        return NextResponse.json({ error: `Failed to upsert to Pinecone: ${(upsertError as Error).message}` }, { status: 500 });
      }

      processedCount += batch.length;
      console.log(`✓ Progress: ${processedCount}/${chunks.length} chunks processed`);

      // Add a small delay to respect rate limits
      if (i + batchSize < chunks.length) {
        console.log("Waiting 1 second to respect rate limits...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Verify the ingestion
    console.log("Verifying ingestion by checking index stats...");
    let stats;
    try {
      stats = await index.describeIndexStats();
      console.log("✓ Index stats retrieved:", stats);
    } catch (statsError) {
      console.error("Error getting index stats:", statsError);
      return NextResponse.json({ error: `Failed to verify ingestion: ${(statsError as Error).message}` }, { status: 500 });
    }

    console.log("🎉 INGESTION COMPLETED SUCCESSFULLY!");
    console.log(`Total chunks processed: ${chunks.length}`);
    console.log(`Total vectors in index: ${stats.totalRecordCount}`);

    return NextResponse.json({
      message: "Document ingestion completed successfully",
      chunksProcessed: chunks.length,
      indexStats: {
        totalVectors: stats.totalRecordCount,
        dimension: stats.dimension,
      },
    });
  } catch (error) {
    console.error("❌ CRITICAL INGESTION ERROR:", error);
    console.error("Error name:", (error as Error).name);
    console.error("Error message:", (error as Error).message);
    console.error("Error stack:", (error as Error).stack);

    return NextResponse.json(
      {
        error: "Failed to ingest document",
        details: (error as Error).message,
        errorType: (error as Error).name,
      },
      { status: 500 }
    );
  }
}
