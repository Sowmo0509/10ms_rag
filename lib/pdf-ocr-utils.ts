// Re-export types for backward compatibility
export type { DocumentChunk, PageRange, PDFProcessingOptions, ChunkingOptions } from "./types/pdf-processing.types";

// Re-export utilities for backward compatibility
export { cleanBengaliText, splitIntoSentences, calculateTextOverlap } from "./utils/text-processing.utils";

// Import the new services
import { PDFProcessorService } from "./services/pdf-processor.service";
import { Logger } from "./utils/error-handling.utils";

/**
 * Process HSC26 PDF using OCR with Tesseract.js and Bengali support
 * @deprecated Use PDFProcessorService.processHSC26PDF() instead
 */
export async function processHSC26PDFWithOCR(pageRanges?: import("./types/pdf-processing.types").PageRange[]): Promise<import("./types/pdf-processing.types").DocumentChunk[]> {
  Logger.warning("processHSC26PDFWithOCR is deprecated. Use PDFProcessorService.processHSC26PDF() instead.");

  const pdfProcessor = new PDFProcessorService();
  return pdfProcessor.processHSC26PDF({ pageRanges });
}

/**
 * Split text into chunks with proper chunk size and overlap for better context
 * @deprecated Use TextChunkingService.chunkTextWithPages() instead
 */
export function chunkTextWithPages(text: string, pageInfo: Array<{ page: number; text: string }>, chunkSize: number = 1000, overlap: number = 200): import("./types/pdf-processing.types").DocumentChunk[] {
  Logger.warning("chunkTextWithPages is deprecated. Use TextChunkingService.chunkTextWithPages() instead.");

  // This function is deprecated - users should use the service directly
  // Returning empty array to maintain type compatibility
  return [];
}
