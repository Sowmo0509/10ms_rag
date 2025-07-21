import { NextRequest, NextResponse } from "next/server";
import { processHSC26PDFWithOCR, PageRange } from "@/lib/pdf-ocr-utils";

export async function POST(req: NextRequest) {
  console.log("=== OCR TEST API CALLED ===");

  try {
    // Test with just a few pages to start
    const testPageRanges: PageRange[] = [{ start: 1, end: 2, description: "Test pages for Bengali OCR" }];

    console.log("🚀 Starting OCR test with pages 1-2...");

    // Process the HSC26 PDF with OCR
    const chunks = await processHSC26PDFWithOCR(testPageRanges);

    console.log(`✅ OCR test completed: ${chunks.length} chunks created`);

    // Log sample chunks for verification
    const sampleChunks = chunks.slice(0, 3).map((chunk) => ({
      page: chunk.metadata.page,
      chunk_index: chunk.metadata.chunk_index,
      char_count: chunk.metadata.char_count,
      content_preview: chunk.content.substring(0, 200) + "...",
    }));

    return NextResponse.json({
      message: "OCR test completed successfully",
      chunksCreated: chunks.length,
      sampleChunks,
      totalCharacters: chunks.reduce((sum, chunk) => sum + chunk.metadata.char_count, 0),
    });
  } catch (error) {
    console.error("❌ OCR TEST ERROR:", error);
    console.error("Error name:", (error as Error).name);
    console.error("Error message:", (error as Error).message);
    console.error("Error stack:", (error as Error).stack);

    return NextResponse.json(
      {
        error: "Failed to run OCR test",
        details: (error as Error).message,
        errorType: (error as Error).name,
      },
      { status: 500 }
    );
  }
}
