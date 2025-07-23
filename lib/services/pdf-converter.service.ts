import { fromPath } from "pdf2pic";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { PageRange, PDFImage } from "../types/pdf-processing.types";
import { Logger } from "../utils/error-handling.utils";

export class PDFConverterService {
  private tempDir: string;

  constructor() {
    this.tempDir = join(process.cwd(), "temp-pdf-images");
  }

  /**
   * Convert PDF pages to images using pdf2pic
   */
  async convertPdfToImages(pdfPath: string, pageRanges?: PageRange[]): Promise<PDFImage[]> {
    Logger.info("📄 Converting PDF pages to images...");

    // Clean up and create temp directory
    this.setupTempDirectory();

    const convert = fromPath(pdfPath, {
      density: 300, // Higher DPI for better OCR
      saveFilename: "page",
      savePath: this.tempDir,
      format: "png",
      width: 2480, // Higher resolution for better text recognition
      height: 3508,
    });

    const images: PDFImage[] = [];

    try {
      if (!pageRanges || pageRanges.length === 0) {
        // Convert all pages
        Logger.info("🔄 Converting all PDF pages...");
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
          Logger.info(`🔄 Converting pages ${range.start}-${range.end}${range.description ? ` (${range.description})` : ""}`);

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
              Logger.warning(`Failed to convert page ${pageNum}:`, pageError);
            }
          }
        }
      }

      Logger.success(`Converted ${images.length} pages to images`);
      return images.sort((a, b) => a.page - b.page);
    } catch (error) {
      Logger.error("Error converting PDF to images:", error);
      throw new Error(`Failed to convert PDF to images: ${(error as Error).message}`);
    }
  }

  /**
   * Clean up temporary images directory
   */
  cleanupTempImages(): void {
    if (existsSync(this.tempDir)) {
      rmSync(this.tempDir, { recursive: true, force: true });
      Logger.info("🧹 Cleaned up temporary images");
    }
  }

  /**
   * Setup temporary directory for image storage
   */
  private setupTempDirectory(): void {
    if (existsSync(this.tempDir)) {
      rmSync(this.tempDir, { recursive: true, force: true });
    }
    mkdirSync(this.tempDir, { recursive: true });
  }

  /**
   * Get temporary directory path
   */
  getTempDirectory(): string {
    return this.tempDir;
  }
}
