import { NextRequest, NextResponse } from "next/server";
import { PineconeService, PineconeVector } from "@/lib/services/pinecone.service";
import { OpenAIService } from "@/lib/services/openai.service";
import { APIErrorHandler, Logger } from "@/lib/utils/error-handling.utils";
import { PDFProcessorService } from "@/lib/services/pdf-processor.service";
import { PageRange, DocumentChunk } from "@/lib/types/pdf-processing.types";
import { ACTIVE_PAGE_CONFIG } from "@/config/pdf-pages";

const pineconeService = new PineconeService();
const openaiService = new OpenAIService();

export async function POST(req: NextRequest) {
  Logger.info("=== INGESTION API CALLED ===");

  try {
    // Environment validation
    const indexName = process.env.PINECONE_INDEX;
    Logger.info("Environment check - PINECONE_INDEX:", indexName ? "✓ Set" : "✗ Missing");
    Logger.info("Environment check - OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✓ Set" : "✗ Missing");
    Logger.info("Environment check - PINECONE_API_KEY:", process.env.PINECONE_API_KEY ? "✓ Set" : "✗ Missing");

    if (!indexName) {
      return APIErrorHandler.handleMissingEnvironmentVariable("PINECONE_INDEX");
    }

    // Parse request body for optional page ranges, or use config file
    let pageRanges: PageRange[] | undefined;
    try {
      const body = await req.json();
      pageRanges = body.pageRanges || (ACTIVE_PAGE_CONFIG.length > 0 ? ACTIVE_PAGE_CONFIG : undefined);
      Logger.info("Request body parsed successfully");
    } catch (error) {
      // If no body or invalid JSON, use config file or all pages
      pageRanges = ACTIVE_PAGE_CONFIG.length > 0 ? ACTIVE_PAGE_CONFIG : undefined;
      Logger.info("No request body, using config file or all pages");
    }

    Logger.info("Page ranges configuration:", pageRanges || "All pages");

    // Check if index exists
    Logger.info("Checking if Pinecone index exists...");
    const indexExists = await pineconeService.checkIndexExists();
    Logger.info("Index check result:", indexExists ? "✓ Exists" : "✗ Not found");

    if (!indexExists) {
      return APIErrorHandler.handleValidationError(`Index "${indexName}" does not exist. Please create it first using /api/create-index`, 400);
    }

    Logger.success("Starting document ingestion...");
    if (pageRanges && pageRanges.length > 0) {
      Logger.info("Page ranges specified:", pageRanges);
    }

    // Process the HSC26 PDF with optional page ranges
    Logger.info("Processing HSC26 PDF...");
    const pdfProcessor = new PDFProcessorService();
    const chunks = await pdfProcessor.processHSC26PDF({ pageRanges });
    Logger.success(`PDF processing complete: ${chunks.length} chunks created`);

    // Process chunks in batches to avoid rate limits
    const batchSize = 10;
    let processedCount = 0;
    Logger.info(`Starting batch processing: ${chunks.length} chunks, batch size: ${batchSize}`);

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(chunks.length / batchSize);

      Logger.info(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} chunks)`);

      // Create embeddings for the batch
      Logger.info("Creating embeddings...");
      const embeddings = await Promise.all(
        batch.map(async (chunk: DocumentChunk, batchIdx: number) => {
          Logger.debug(`Creating embedding for chunk ${chunk.metadata.chunk_index} (${chunk.content.length} chars)`);
          const embedding = await openaiService.createEmbedding(chunk.content);
          Logger.debug(`Embedding created for chunk ${chunk.metadata.chunk_index}`);
          return embedding;
        })
      );
      Logger.success(`All embeddings created for batch (${embeddings.length} embeddings)`);

      // Prepare vectors for upsert
      Logger.info("Preparing vectors for Pinecone upsert...");
      const vectors: PineconeVector[] = batch.map((chunk: DocumentChunk, idx: number) => ({
        id: `hsc26_chunk_${chunk.metadata.chunk_index}`,
        values: embeddings[idx],
        metadata: {
          content: chunk.content,
          source: chunk.metadata.source,
          chunk_index: chunk.metadata.chunk_index,
          char_count: chunk.metadata.char_count,
        },
      }));
      Logger.success(`${vectors.length} vectors prepared`);

      // Upsert to Pinecone
      Logger.info("Upserting vectors to Pinecone...");
      await pineconeService.upsertVectors(vectors);
      Logger.success("Batch upserted successfully");

      processedCount += batch.length;
      Logger.progress(processedCount, chunks.length, "chunks processed");

      // Add a small delay to respect rate limits
      if (i + batchSize < chunks.length) {
        Logger.debug("Waiting 1 second to respect rate limits...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Verify the ingestion
    Logger.info("Verifying ingestion by checking index stats...");
    const stats = await pineconeService.getIndexStats();
    Logger.success("Index stats retrieved:", stats);

    Logger.success("🎉 INGESTION COMPLETED SUCCESSFULLY!");
    Logger.info(`Total chunks processed: ${chunks.length}`);
    Logger.info(`Total vectors in index: ${stats.totalRecordCount}`);

    return NextResponse.json({
      message: "Document ingestion completed successfully",
      chunksProcessed: chunks.length,
      indexStats: {
        totalVectors: stats.totalRecordCount,
        dimension: stats.dimension,
      },
    });
  } catch (error) {
    return APIErrorHandler.handleError(error, "CRITICAL INGESTION");
  }
}
