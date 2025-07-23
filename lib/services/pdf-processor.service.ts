import { existsSync } from "fs";
import { join } from "path";
import { DocumentChunk, PDFProcessingOptions } from "../types/pdf-processing.types";
import { PDFConverterService } from "./pdf-converter.service";
import { OCRService } from "./ocr.service";
import { TextChunkingService } from "./text-chunking.service";
import { Logger } from "../utils/error-handling.utils";

export class PDFProcessorService {
  private pdfConverter: PDFConverterService;
  private ocrService: OCRService;
  private textChunker: TextChunkingService;

  constructor() {
    this.pdfConverter = new PDFConverterService();
    this.ocrService = new OCRService();
    this.textChunker = new TextChunkingService();
  }

  /**
   * Process PDF file with OCR and return document chunks
   */
  async processPDF(pdfPath: string, options: PDFProcessingOptions = {}): Promise<DocumentChunk[]> {
    Logger.info("🚀 Starting PDF processing with OCR...");

    // Validate PDF file exists
    if (!existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    Logger.success(`PDF file found: ${pdfPath}`);

    try {
      // Step 1: Convert PDF pages to images
      Logger.info("📄 Step 1: Converting PDF to images...");
      const images = await this.pdfConverter.convertPdfToImages(pdfPath, options.pageRanges);

      if (images.length === 0) {
        throw new Error("No images were generated from the PDF");
      }

      // Step 2: Extract text using OCR
      Logger.info("🔤 Step 2: Extracting text using OCR...");

      // Initialize OCR service with specified languages
      if (options.ocrLanguages) {
        this.ocrService = new OCRService(options.ocrLanguages);
      }

      const { text, pageInfo } = await this.ocrService.extractTextFromImages(images);

      if (!text || text.length < 100) {
        throw new Error("Insufficient text extracted from PDF");
      }

      Logger.info(`📄 Total text extracted: ${text.length} characters`);

      // Step 3: Chunk the text
      Logger.info("✂️ Step 3: Chunking text...");
      const chunks = this.textChunker.chunkTextWithPages(text, pageInfo, options.chunkingOptions);

      Logger.success(`🔢 Created ${chunks.length} chunks`);

      // Log sample chunk for verification
      if (chunks.length > 0) {
        Logger.info(`📋 Sample chunk content: "${chunks[0].content.substring(0, 200)}..."`);
      }

      return chunks;
    } catch (error) {
      Logger.error("Error processing PDF:", error);
      throw new Error(`Failed to process PDF: ${(error as Error).message}`);
    } finally {
      // Cleanup resources
      await this.cleanup();
    }
  }

  /**
   * Process HSC26 PDF specifically (maintains backward compatibility)
   */
  async processHSC26PDF(options: PDFProcessingOptions = {}): Promise<DocumentChunk[]> {
    const pdfPath = join(process.cwd(), "public", "files", "hsc26.pdf");

    // Set default options for HSC26 processing
    const hsc26Options: PDFProcessingOptions = {
      ocrLanguages: "ben+eng",
      chunkingOptions: {
        chunkSize: 1000,
        overlap: 200,
        minChunkSize: 50,
      },
      ...options,
    };

    return this.processPDF(pdfPath, hsc26Options);
  }

  /**
   * Cleanup resources and temporary files
   */
  private async cleanup(): Promise<void> {
    try {
      // Terminate OCR worker
      await this.ocrService.terminateWorker();

      // Clean up temporary images
      this.pdfConverter.cleanupTempImages();

      Logger.info("🧹 Cleanup completed successfully");
    } catch (error) {
      Logger.warning("Error during cleanup:", error);
    }
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(chunks: DocumentChunk[]): {
    totalChunks: number;
    totalCharacters: number;
    averageChunkSize: number;
    pagesProcessed: number;
  } {
    const totalCharacters = chunks.reduce((sum, chunk) => sum + chunk.metadata.char_count, 0);
    const averageChunkSize = chunks.length > 0 ? Math.round(totalCharacters / chunks.length) : 0;
    const pagesProcessed = new Set(chunks.map((chunk) => chunk.metadata.page).filter((page) => page !== undefined)).size;

    return {
      totalChunks: chunks.length,
      totalCharacters,
      averageChunkSize,
      pagesProcessed,
    };
  }
}
