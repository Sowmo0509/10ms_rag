import pdf from "pdf-parse";
import { readFileSync, existsSync } from "fs";
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
 * Extract text content from specific pages of a PDF file
 */
export async function extractTextFromPDF(filePath: string, pageRanges?: PageRange[]): Promise<{ text: string; pageInfo: Array<{ page: number; text: string }> }> {
  try {
    console.log("🔍 Reading PDF file...");
    const dataBuffer = readFileSync(filePath);
    console.log(`✓ PDF file loaded: ${dataBuffer.length} bytes`);

    // Try simple extraction first (without custom page rendering)
    console.log("🔍 Attempting simple PDF parsing...");
    const simpleData = await pdf(dataBuffer);
    console.log(`📄 Simple extraction result: ${simpleData.numpages} pages, ${simpleData.text.length} characters`);

    if (simpleData.text.length > 0) {
      console.log("✓ Simple extraction successful!");
      console.log("📋 Sample text:", simpleData.text.substring(0, 200));

      // Use simple extraction result
      const pages = simpleData.text.split(/\n\s*\n\s*\n/); // Split by multiple newlines
      let pageInfo: Array<{ page: number; text: string }> = [];
      let combinedText = "";

      if (!pageRanges || pageRanges.length === 0) {
        combinedText = simpleData.text;
        pageInfo = pages.map((pageText, index) => ({
          page: index + 1,
          text: pageText,
        }));
      } else {
        // Extract specified page ranges
        console.log(`Total pages available: ${pages.length}`);
        console.log(
          `Page split preview:`,
          pages.slice(0, 3).map((p, i) => `Page ${i + 1}: ${p.substring(0, 50)}...`)
        );

        for (const range of pageRanges) {
          console.log(`Extracting pages ${range.start}-${range.end}${range.description ? ` (${range.description})` : ""}`);

          // Since the PDF text might not split perfectly by pages, let's try a different approach
          // Calculate approximate text positions for page ranges
          const totalText = simpleData.text;
          const textPerPage = Math.floor(totalText.length / simpleData.numpages);

          const startPos = Math.max(0, (range.start - 1) * textPerPage);
          const endPos = Math.min(totalText.length, range.end * textPerPage);

          if (startPos < endPos) {
            const rangeText = totalText.substring(startPos, endPos);
            console.log(`📄 Extracted ${rangeText.length} characters from pages ${range.start}-${range.end}`);
            console.log(`📋 Sample from range: ${rangeText.substring(0, 100)}...`);

            if (rangeText.trim()) {
              pageInfo.push({
                page: range.start,
                text: rangeText,
              });
              combinedText += rangeText + "\n\n";
            }
          }
        }

        console.log(`📊 Final combined text length: ${combinedText.length}`);
      }

      return { text: combinedText, pageInfo };
    }

    // If simple extraction failed, try custom rendering optimized for Bengali
    console.log("⚠️ Simple extraction failed, trying custom page rendering optimized for Bengali...");

    // Custom render function to extract text with Bengali-aware processing
    const options = {
      pagerender: async (pageData: unknown) => {
        const render_options = {
          normalizeWhitespace: false, // Keep original whitespace for Bengali
          disableCombineTextItems: true, // Don't combine text items to preserve Bengali character boundaries
        };

        return (pageData as { getTextContent: (opts: unknown) => Promise<{ items: Array<{ str: string; transform: number[] }> }> }).getTextContent(render_options).then((textContent) => {
          let lastY: number | undefined,
            text = "";
          for (const item of textContent.items) {
            if (lastY == item.transform[5] || !lastY) {
              // Same line - be more careful about spacing for Bengali text
              if (text && !text.endsWith(" ") && item.str && !item.str.startsWith(" ")) {
                // Check if this looks like a continuation of Bengali text
                const lastChar = text.slice(-1);
                const firstChar = item.str.charAt(0);
                const isBengaliContinuation = lastChar.match(/[\u0980-\u09FF]/) && firstChar.match(/[\u0980-\u09FF]/) && !firstChar.match(/[ক-হড়ঢ়য়]/); // Not starting with a consonant

                if (!isBengaliContinuation) {
                  text += " ";
                }
              }
              text += item.str;
            } else {
              text += "\n" + item.str;
            }
            lastY = item.transform[5];
          }
          return text;
        });
      },
    };

    const data = await pdf(dataBuffer, options);
    console.log(`📄 Custom extraction result: ${data.numpages} pages, ${data.text.length} characters`);
    const pages = data.text.split("\n\n\n"); // Rough page separation

    let pageInfo: Array<{ page: number; text: string }> = [];
    let combinedText = "";

    // If no page ranges specified, use all pages
    if (!pageRanges || pageRanges.length === 0) {
      combinedText = data.text;
      pageInfo = pages.map((pageText, index) => ({
        page: index + 1,
        text: pageText,
      }));
    } else {
      // Extract only specified page ranges
      for (const range of pageRanges) {
        console.log(`Extracting pages ${range.start}-${range.end}${range.description ? ` (${range.description})` : ""}`);

        for (let pageNum = range.start; pageNum <= range.end && pageNum <= pages.length; pageNum++) {
          const pageText = pages[pageNum - 1] || "";
          if (pageText.trim()) {
            pageInfo.push({
              page: pageNum,
              text: pageText,
            });
            combinedText += pageText + "\n\n";
          }
        }
      }
    }

    return { text: combinedText, pageInfo };
  } catch (error) {
    console.error("❌ Error extracting text from PDF:", error);
    console.error("Error details:", error);

    // Last resort: try basic pdf-parse without any options
    try {
      console.log("🔄 Attempting basic PDF parsing as last resort...");
      const dataBuffer = readFileSync(filePath);
      const basicData = await pdf(dataBuffer, { max: 0 }); // Extract all pages
      console.log(`📄 Basic extraction result: ${basicData.numpages} pages, ${basicData.text.length} characters`);

      if (basicData.text.length > 0) {
        console.log("✓ Basic extraction successful!");
        return {
          text: basicData.text,
          pageInfo: [{ page: 1, text: basicData.text }],
        };
      }
    } catch (fallbackError) {
      console.error("❌ Fallback extraction also failed:", fallbackError);
    }

    throw new Error(`Failed to extract text from PDF: ${(error as Error).message}`);
  }
}

/**
 * Clean and normalize text for better processing
 * Handles Bengali text preprocessing
 */
export function cleanText(text: string): string {
  console.log("🧹 Starting text cleaning...");
  console.log(`📝 Original text sample: "${text.substring(0, 200)}..."`);

  // First, fix Bengali character fragmentation issues
  const normalized = text
    // Fix broken hasanta (virama) - reconnect consonant clusters
    .replace(/\u09CD\s+/g, "\u09CD") // Remove spaces after hasanta
    .replace(/([ক-হড়ঢ়য়])\s+\u09CD/g, "$1\u09CD") // Remove spaces before hasanta

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
    .replace(/\s+\u09D7/g, "\u09D7") // Fix broken au length mark (ৗ)

    // Fix spaces within Bengali conjuncts
    .replace(/([ক-হড়ঢ়য়])\u09CD\s+([ক-হড়ঢ়য়])/g, "$1\u09CD$2")

    // Fix general spaces between Bengali characters that should be connected
    .replace(/([ক-হড়ঢ়য়\u09BE-\u09CC])\s+([ক-হড়ঢ়য়\u09BE-\u09CC])/g, function (match, p1, p2) {
      // Only join if it looks like a broken word (not between actual words)
      if (p1.match(/[\u09BE-\u09CC]/) || p2.match(/[\u09BE-\u09CC]/)) {
        return p1 + p2; // Join vowel marks
      }
      return match; // Keep space between actual consonants
    })

    // Normalize Unicode to ensure proper rendering
    .normalize("NFC");

  console.log(`🔧 After Bengali fixes: "${normalized.substring(0, 200)}..."`);

  // Remove excessive whitespace and normalize
  let cleaned = normalized
    .replace(/\r\n/g, "\n") // Normalize line endings
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n") // Limit consecutive newlines
    .replace(/[ \t]{2,}/g, " ") // Remove excessive spaces
    .trim();

  // Handle Bengali-specific cleaning
  cleaned = cleaned
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // Remove zero-width characters
    .replace(/\u00A0/g, " ") // Replace non-breaking spaces
    // Keep Bengali nukta (important for some characters)
    // .replace(/[\u0981\u09BC]/g, "") // Remove certain Bengali diacritics that might cause issues
    .trim();

  console.log(`✅ Final cleaned text sample: "${cleaned.substring(0, 200)}..."`);
  console.log(`📊 Text length: ${text.length} → ${cleaned.length}`);

  return cleaned;
}

/**
 * Split text into chunks with overlap for better context preservation
 * Optimized for Bengali text boundaries
 */
export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): DocumentChunk[] {
  const cleanedText = cleanText(text);
  const chunks: DocumentChunk[] = [];

  // Split by sentences first (looking for Bengali and English sentence endings)
  const sentences = cleanedText.split(/(?<=[।.!?])\s+/);

  let currentChunk = "";
  let chunkIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();

    // If adding this sentence would exceed chunk size, finalize current chunk
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            source: "hsc26.pdf",
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
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        source: "hsc26.pdf",
        chunk_index: chunkIndex,
        char_count: currentChunk.trim().length,
      },
    });
  }

  // Filter out very short chunks (less than 50 characters)
  return chunks.filter((chunk) => chunk.content.length >= 50);
}

/**
 * Split text into chunks with page information preserved
 */
export function chunkTextWithPages(text: string, pageInfo: Array<{ page: number; text: string }>, chunkSize: number = 1000, overlap: number = 200): DocumentChunk[] {
  console.log("🔄 Starting text chunking...");
  console.log(`Input text length: ${text.length}`);
  console.log(`Page info count: ${pageInfo.length}`);
  console.log(`Chunk size: ${chunkSize}, overlap: ${overlap}`);

  const cleanedText = cleanText(text);
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
    const cleanPageText = cleanText(pageData.text);
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
 * Process the HSC26 PDF file and return document chunks
 * @param pageRanges - Optional array of page ranges to extract specific pages
 */
export async function processHSC26PDF(pageRanges?: PageRange[]): Promise<DocumentChunk[]> {
  try {
    const pdfPath = join(process.cwd(), "public", "files", "hsc26.pdf");
    console.log("📄 Processing PDF at:", pdfPath);

    // Check if file exists
    if (!existsSync(pdfPath)) {
      console.error("❌ PDF file not found at:", pdfPath);
      throw new Error(`PDF file not found at: ${pdfPath}`);
    }
    console.log("✓ PDF file exists");

    const { text, pageInfo } = await extractTextFromPDF(pdfPath, pageRanges);
    console.log(`📝 Extracted ${text.length} characters from ${pageInfo.length} pages`);

    if (text.length === 0) {
      console.error("❌ No text extracted from PDF");
      throw new Error("No text was extracted from the PDF file");
    }

    // Log first 200 characters of extracted text for debugging
    console.log("📋 Sample extracted text:", text.substring(0, 200) + (text.length > 200 ? "..." : ""));

    // Create chunks with page information
    const chunks = chunkTextWithPages(text, pageInfo, 1000, 200);
    console.log(`🔢 Created ${chunks.length} chunks`);

    if (chunks.length === 0) {
      console.error("❌ No chunks created from text");
      console.log("Text length:", text.length);
      console.log("Page info:", pageInfo);
    }

    return chunks;
  } catch (error) {
    console.error("❌ Error processing HSC26 PDF:", error);
    throw error;
  }
}
