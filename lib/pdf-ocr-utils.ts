import { createWorker } from "tesseract.js";
import { fromPath } from "pdf2pic";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

export interface DocumentChunk {
  content: string;
  metadata: {
    source: string;
    page?: number;
    chunk_index: number;
    char_count: number;
  };
}

export interface PageRange {
  start: number;
  end: number;
  description?: string;
}

/**
 * Convert PDF pages to images using pdf2pic
 */
async function convertPdfToImages(pdfPath: string, pageRanges?: PageRange[]): Promise<Array<{ page: number; imagePath: string }>> {
  console.log("📄 Converting PDF pages to images...");

  const tempDir = join(process.cwd(), "temp-pdf-images");

  // Clean up and create temp directory
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
  mkdirSync(tempDir, { recursive: true });

  const convert = fromPath(pdfPath, {
    density: 300, // Higher DPI for better OCR
    saveFilename: "page",
    savePath: tempDir,
    format: "png",
    width: 2480, // Higher resolution for better text recognition
    height: 3508,
  });

  const images: Array<{ page: number; imagePath: string }> = [];

  try {
    if (!pageRanges || pageRanges.length === 0) {
      // Convert all pages
      console.log("🔄 Converting all PDF pages...");
      const result = await convert.bulk(-1); // Convert all pages

      if (Array.isArray(result)) {
        for (const pageResult of result) {
          if (pageResult.path) {
            images.push({
              page: pageResult.page || 1,
              imagePath: pageResult.path,
            });
          }
        }
      }
    } else {
      // Convert specific page ranges
      for (const range of pageRanges) {
        console.log(`🔄 Converting pages ${range.start}-${range.end}${range.description ? ` (${range.description})` : ""}`);

        for (let pageNum = range.start; pageNum <= range.end; pageNum++) {
          try {
            const pageResult = await convert(pageNum);
            if (pageResult.path) {
              images.push({
                page: pageNum,
                imagePath: pageResult.path,
              });
            }
          } catch (pageError) {
            console.warn(`⚠️ Failed to convert page ${pageNum}:`, pageError);
          }
        }
      }
    }

    console.log(`✅ Converted ${images.length} pages to images`);
    return images.sort((a, b) => a.page - b.page);
  } catch (error) {
    console.error("❌ Error converting PDF to images:", error);
    throw new Error(`Failed to convert PDF to images: ${(error as Error).message}`);
  }
}

/**
 * Extract text from images using Tesseract.js OCR with Bengali support
 */
async function extractTextFromImages(images: Array<{ page: number; imagePath: string }>): Promise<{ text: string; pageInfo: Array<{ page: number; text: string }> }> {
  console.log("🔍 Starting OCR text extraction with Bengali support...");

  // Initialize Tesseract worker with Bengali + English languages
  console.log("🚀 Initializing Tesseract worker with Bengali (ben) and English (eng) languages...");

  let worker;
  try {
    // Create worker with proper configuration for Node.js
    worker = await createWorker();
    await worker.loadLanguage("ben+eng");
    await worker.initialize("ben+eng");
    console.log("🔧 Bengali and English languages loaded successfully");
    console.log("✅ Tesseract worker initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize Tesseract worker:", error);
    throw new Error(`Failed to initialize OCR worker: ${(error as Error).message}`);
  }

  const pageInfo: Array<{ page: number; text: string }> = [];
  let combinedText = "";

  try {
    for (const image of images) {
      console.log(`🔤 Extracting text from page ${image.page}...`);

      try {
        const {
          data: { text },
        } = await worker.recognize(image.imagePath);

        const cleanedText = cleanBengaliText(text);

        if (cleanedText.length > 50) {
          // Only include pages with meaningful content
          pageInfo.push({
            page: image.page,
            text: cleanedText,
          });
          combinedText += cleanedText + "\n\n";

          console.log(`✅ Page ${image.page}: ${cleanedText.length} characters extracted`);
          console.log(`📋 Sample: "${cleanedText.substring(0, 100)}..."`);
        } else {
          console.log(`⚠️ Page ${image.page}: Insufficient text (${cleanedText.length} chars), skipping`);
        }
      } catch (pageError) {
        console.error(`❌ Failed to extract text from page ${image.page}:`, pageError);
      }
    }

    console.log(`🎉 OCR completed: ${pageInfo.length} pages processed`);
    return { text: combinedText, pageInfo };
  } finally {
    // Properly terminate the worker
    if (worker) {
      try {
        await worker.terminate();
        console.log("🔚 Tesseract worker terminated");
      } catch (terminateError) {
        console.warn("⚠️ Error terminating worker:", terminateError);
      }
    }

    // Clean up temporary images
    const tempDir = join(process.cwd(), "temp-pdf-images");
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
      console.log("🧹 Cleaned up temporary images");
    }
  }
}

/**
 * Advanced Bengali text cleaning and normalization
 */
export function cleanBengaliText(text: string): string {
  console.log("🧹 Starting Bengali text cleaning...");
  console.log(`📝 Original text sample: "${text.substring(0, 200)}..."`);

  // Step 1: Basic cleanup
  let cleaned = text
    .replace(/\r\n/g, "\n") // Normalize line endings
    .replace(/\r/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // Remove zero-width characters
    .replace(/\u00A0/g, " ") // Replace non-breaking spaces
    .trim();

  // Step 2: Fix Bengali character fragmentation issues
  cleaned = cleaned
    // Fix broken hasanta (virama) - reconnect consonant clusters
    .replace(/\u09CD\s+/g, "\u09CD") // Remove spaces after hasanta
    .replace(/([ক-হড়ঢ়য়])\s+\u09CD/g, "$1\u09CD") // Remove spaces before hasanta
    .replace(/([ক-হড়ঢ়য়])\u09CD\s+([ক-হড়ঢ়য়])/g, "$1\u09CD$2") // Fix spaces in conjuncts

    // Fix broken vowel marks (kar) - these should attach to consonants
    .replace(/\s+\u09BE/g, "\u09BE") // Fix broken aa-kar (া)
    .replace(/\s+\u09BF/g, "\u09BF") // Fix broken i-kar (ি)
    .replace(/\s+\u09C0/g, "\u09C0") // Fix broken ii-kar (ী)
    .replace(/\s+\u09C1/g, "\u09C1") // Fix broken u-kar (ু)
    .replace(/\s+\u09C2/g, "\u09C2") // Fix broken uu-kar (ূ)
    .replace(/\s+\u09C7/g, "\u09C7") // Fix broken e-kar (ে)
    .replace(/\s+\u09C8/g, "\u09C8") // Fix broken oi-kar (ৈ)
    .replace(/\s+\u09CB/g, "\u09CB") // Fix broken o-kar (ো)
    .replace(/\s+\u09CC/g, "\u09CC") // Fix broken ou-kar (ৌ)
    .replace(/\s+\u09D7/g, "\u09D7"); // Fix broken au length mark (ৗ)

  // Step 3: Fix common OCR errors in Bengali
  cleaned = cleaned
    // Fix common character confusions
    .replace(/০/g, "০") // Ensure proper Bengali zero
    .replace(/১/g, "১") // Ensure proper Bengali one
    .replace(/২/g, "২") // Ensure proper Bengali two
    .replace(/৩/g, "৩") // Ensure proper Bengali three
    .replace(/৪/g, "৪") // Ensure proper Bengali four
    .replace(/৫/g, "৫") // Ensure proper Bengali five
    .replace(/৬/g, "৬") // Ensure proper Bengali six
    .replace(/৭/g, "৭") // Ensure proper Bengali seven
    .replace(/৮/g, "৮") // Ensure proper Bengali eight
    .replace(/৯/g, "৯") // Ensure proper Bengali nine

    // Fix punctuation
    .replace(/।\s*।/g, "।") // Remove duplicate sentence enders
    .replace(/\?\s*\?/g, "?") // Remove duplicate question marks
    .replace(/!\s*!/g, "!"); // Remove duplicate exclamation marks;

  // Step 4: Normalize Unicode to ensure proper rendering
  cleaned = cleaned.normalize("NFC");

  // Step 5: Final cleanup
  cleaned = cleaned
    .replace(/\n{3,}/g, "\n\n") // Limit consecutive newlines
    .replace(/[ \t]{2,}/g, " ") // Remove excessive spaces
    .replace(/\s+([।,;:!?])/g, "$1") // Remove spaces before punctuation
    .replace(/([।,;:!?])\s*([।,;:!?])/g, "$1$2") // Remove spaces between punctuation
    .trim();

  console.log(`🔧 After Bengali fixes: "${cleaned.substring(0, 200)}..."`);
  console.log(`📊 Text length: ${text.length} → ${cleaned.length}`);

  return cleaned;
}

/**
 * Split text into chunks with proper chunk size and overlap for better context
 */
export function chunkTextWithPages(text: string, pageInfo: Array<{ page: number; text: string }>, chunkSize: number = 1000, overlap: number = 200): DocumentChunk[] {
  console.log("🔄 Starting text chunking with proper chunk size and overlap...");
  console.log(`Input text length: ${text.length}`);
  console.log(`Page info count: ${pageInfo.length}`);
  console.log(`Chunk size: ${chunkSize}, overlap: ${overlap}`);

  const cleanedText = cleanBengaliText(text);
  console.log(`Cleaned text length: ${cleanedText.length}`);

  const chunks: DocumentChunk[] = [];

  // Split by sentences first (looking for Bengali and English sentence endings)
  const sentences = cleanedText.split(/(?<=[।.!?])\s+/);
  console.log(`Split into ${sentences.length} sentences`);

  let currentChunk = "";
  let chunkIndex = 0;
  let currentPageNumbers: number[] = [];

  // Create a mapping of text positions to page numbers (simplified approach)
  const textToPageMap = new Map<string, number>();
  for (const pageData of pageInfo) {
    const cleanPageText = cleanBengaliText(pageData.text);
    if (cleanPageText.trim()) {
      textToPageMap.set(cleanPageText.substring(0, 100), pageData.page); // Use first 100 chars as key
    }
  }

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();

    // Try to determine which page this sentence belongs to
    let sentencePage: number | undefined;
    for (const [pageText, pageNum] of textToPageMap.entries()) {
      if (pageText.includes(sentence.substring(0, 50))) {
        sentencePage = pageNum;
        break;
      }
    }

    // If adding this sentence would exceed chunk size, finalize current chunk
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            source: "hsc26.pdf",
            page: currentPageNumbers.length > 0 ? Math.min(...currentPageNumbers) : undefined,
            chunk_index: chunkIndex,
            char_count: currentChunk.trim().length,
          },
        });
        chunkIndex++;
      }

      // Start new chunk with overlap from previous chunk
      const words = currentChunk.trim().split(/\s+/);
      const overlapWords = words.slice(-Math.floor(overlap / 6)); // Approximate word count for overlap
      currentChunk = overlapWords.join(" ") + " " + sentence;
      currentPageNumbers = sentencePage ? [sentencePage] : [];
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
      if (sentencePage && !currentPageNumbers.includes(sentencePage)) {
        currentPageNumbers.push(sentencePage);
      }
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        source: "hsc26.pdf",
        page: currentPageNumbers.length > 0 ? Math.min(...currentPageNumbers) : undefined,
        chunk_index: chunkIndex,
        char_count: currentChunk.trim().length,
      },
    });
  }

  // Filter out very short chunks (less than 50 characters)
  console.log(`📊 Before filtering: ${chunks.length} chunks`);
  const filteredChunks = chunks.filter((chunk) => chunk.content.length >= 50);
  console.log(`📊 After filtering (>= 50 chars): ${filteredChunks.length} chunks`);

  if (filteredChunks.length > 0) {
    console.log(`📋 Sample chunk: "${filteredChunks[0].content.substring(0, 100)}..."`);
    console.log(`📋 Average chunk size: ${Math.round(filteredChunks.reduce((sum, chunk) => sum + chunk.metadata.char_count, 0) / filteredChunks.length)} characters`);
  } else {
    console.log("❌ No chunks remain after filtering");
    console.log(
      "Original chunks before filtering:",
      chunks.map((c) => ({ length: c.content.length, preview: c.content.substring(0, 50) }))
    );
  }

  return filteredChunks;
}

/**
 * Calculate text overlap between two strings (simple character-based)
 */
function getTextOverlap(text1: string, text2: string): number {
  const shorter = text1.length < text2.length ? text1 : text2;
  const longer = text1.length >= text2.length ? text1 : text2;

  let maxOverlap = 0;
  for (let i = 0; i < shorter.length - 50; i += 10) {
    const substring = shorter.substring(i, i + 100);
    if (longer.includes(substring)) {
      maxOverlap = Math.max(maxOverlap, substring.length);
    }
  }

  return maxOverlap;
}

/**
 * Process HSC26 PDF using OCR with Tesseract.js and Bengali support
 */
export async function processHSC26PDFWithOCR(pageRanges?: PageRange[]): Promise<DocumentChunk[]> {
  console.log("🚀 Starting HSC26 PDF processing with OCR and Bengali support...");

  const pdfPath = join(process.cwd(), "public", "files", "hsc26.pdf");

  if (!existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  console.log(`✅ PDF file found: ${pdfPath}`);

  try {
    // Step 1: Convert PDF pages to images
    console.log("📄 Step 1: Converting PDF to images...");
    const images = await convertPdfToImages(pdfPath, pageRanges);

    if (images.length === 0) {
      throw new Error("No images were generated from the PDF");
    }

    // Step 2: Extract text using OCR with Bengali support
    console.log("🔤 Step 2: Extracting text using OCR...");
    const { text, pageInfo } = await extractTextFromImages(images);

    if (!text || text.length < 100) {
      throw new Error("Insufficient text extracted from PDF");
    }

    console.log(`📄 Total text extracted: ${text.length} characters`);

    // Step 3: Chunk the text
    console.log("✂️ Step 3: Chunking text...");
    const chunks = chunkTextWithPages(text, pageInfo);

    console.log(`🔢 Created ${chunks.length} chunks`);

    // Log sample chunk for verification
    if (chunks.length > 0) {
      console.log(`📋 Sample chunk content: "${chunks[0].content.substring(0, 200)}..."`);
    }

    return chunks;
  } catch (error) {
    console.error("❌ Error processing PDF with OCR:", error);
    throw new Error(`Failed to process PDF with OCR: ${(error as Error).message}`);
  }
}
