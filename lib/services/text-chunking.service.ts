import { DocumentChunk, ChunkingOptions } from "../types/pdf-processing.types";
import { Logger } from "../utils/error-handling.utils";
import { cleanBengaliText, splitIntoSentences } from "../utils/text-processing.utils";

export class TextChunkingService {
  private defaultOptions: Required<ChunkingOptions> = {
    chunkSize: 1000,
    overlap: 200,
    minChunkSize: 50,
  };

  /**
   * Split text into chunks with proper chunk size and overlap for better context
   */
  chunkTextWithPages(text: string, pageInfo: Array<{ page: number; text: string }>, options: ChunkingOptions = {}): DocumentChunk[] {
    const config = { ...this.defaultOptions, ...options };

    Logger.info("🔄 Starting text chunking with proper chunk size and overlap...");
    Logger.info(`Input text length: ${text.length}`);
    Logger.info(`Page info count: ${pageInfo.length}`);
    Logger.info(`Chunk size: ${config.chunkSize}, overlap: ${config.overlap}`);

    const cleanedText = cleanBengaliText(text);
    Logger.info(`Cleaned text length: ${cleanedText.length}`);

    const chunks: DocumentChunk[] = [];

    // Split by sentences first (looking for Bengali and English sentence endings)
    const sentences = splitIntoSentences(cleanedText);
    Logger.info(`Split into ${sentences.length} sentences`);

    let currentChunk = "";
    let chunkIndex = 0;
    let currentPageNumbers: number[] = [];

    // Create a mapping of text positions to page numbers
    const textToPageMap = this.createTextToPageMap(pageInfo);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();

      // Try to determine which page this sentence belongs to
      const sentencePage = this.findSentencePage(sentence, textToPageMap);

      // If adding this sentence would exceed chunk size, finalize current chunk
      if (currentChunk.length + sentence.length > config.chunkSize && currentChunk.length > 0) {
        if (currentChunk.trim()) {
          chunks.push(this.createChunk(currentChunk.trim(), currentPageNumbers, chunkIndex));
          chunkIndex++;
        }

        // Start new chunk with overlap from previous chunk
        const overlapText = this.createOverlapText(currentChunk, config.overlap);
        currentChunk = overlapText + (overlapText ? " " : "") + sentence;
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
      chunks.push(this.createChunk(currentChunk.trim(), currentPageNumbers, chunkIndex));
    }

    // Filter out very short chunks
    Logger.info(`📊 Before filtering: ${chunks.length} chunks`);
    const filteredChunks = chunks.filter((chunk) => chunk.content.length >= config.minChunkSize);
    Logger.info(`📊 After filtering (>= ${config.minChunkSize} chars): ${filteredChunks.length} chunks`);

    this.logChunkingResults(filteredChunks);

    return filteredChunks;
  }

  /**
   * Create a simple chunk without page information
   */
  chunkText(text: string, options: ChunkingOptions = {}): DocumentChunk[] {
    const config = { ...this.defaultOptions, ...options };

    Logger.info("🔄 Starting simple text chunking...");

    const cleanedText = cleanBengaliText(text);
    const sentences = splitIntoSentences(cleanedText);

    const chunks: DocumentChunk[] = [];
    let currentChunk = "";
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > config.chunkSize && currentChunk.length > 0) {
        if (currentChunk.trim()) {
          chunks.push(this.createChunk(currentChunk.trim(), [], chunkIndex));
          chunkIndex++;
        }

        const overlapText = this.createOverlapText(currentChunk, config.overlap);
        currentChunk = overlapText + (overlapText ? " " : "") + sentence;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk.trim(), [], chunkIndex));
    }

    return chunks.filter((chunk) => chunk.content.length >= config.minChunkSize);
  }

  /**
   * Create a mapping of text positions to page numbers
   */
  private createTextToPageMap(pageInfo: Array<{ page: number; text: string }>): Map<string, number> {
    const textToPageMap = new Map<string, number>();

    for (const pageData of pageInfo) {
      const cleanPageText = cleanBengaliText(pageData.text);
      if (cleanPageText.trim()) {
        // Use first 100 chars as key for mapping
        textToPageMap.set(cleanPageText.substring(0, 100), pageData.page);
      }
    }

    return textToPageMap;
  }

  /**
   * Find which page a sentence belongs to
   */
  private findSentencePage(sentence: string, textToPageMap: Map<string, number>): number | undefined {
    for (const [pageText, pageNum] of textToPageMap.entries()) {
      if (pageText.includes(sentence.substring(0, 50))) {
        return pageNum;
      }
    }
    return undefined;
  }

  /**
   * Create overlap text from the end of current chunk
   */
  private createOverlapText(currentChunk: string, overlap: number): string {
    const words = currentChunk.trim().split(/\s+/);
    const overlapWords = words.slice(-Math.floor(overlap / 6)); // Approximate word count for overlap
    return overlapWords.join(" ");
  }

  /**
   * Create a document chunk with metadata
   */
  private createChunk(content: string, pageNumbers: number[], chunkIndex: number): DocumentChunk {
    return {
      content,
      metadata: {
        source: "hsc26.pdf",
        page: pageNumbers.length > 0 ? Math.min(...pageNumbers) : undefined,
        chunk_index: chunkIndex,
        char_count: content.length,
      },
    };
  }

  /**
   * Log chunking results for debugging
   */
  private logChunkingResults(chunks: DocumentChunk[]): void {
    if (chunks.length > 0) {
      Logger.info(`📋 Sample chunk: "${chunks[0].content.substring(0, 100)}..."`);
      const avgChunkSize = Math.round(chunks.reduce((sum, chunk) => sum + chunk.metadata.char_count, 0) / chunks.length);
      Logger.info(`📋 Average chunk size: ${avgChunkSize} characters`);
    } else {
      Logger.warning("No chunks remain after filtering");
    }
  }
}
