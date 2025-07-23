import { createWorker } from "tesseract.js";
import { PDFImage, OCRResult } from "../types/pdf-processing.types";
import { Logger } from "../utils/error-handling.utils";
import { cleanBengaliText } from "../utils/text-processing.utils";

export class OCRService {
  private worker: Tesseract.Worker | null = null;
  private languages: string;

  constructor(languages: string = "ben+eng") {
    this.languages = languages;
  }

  /**
   * Initialize Tesseract worker with specified languages
   */
  async initializeWorker(): Promise<void> {
    Logger.info(`🚀 Initializing Tesseract worker with ${this.languages} languages...`);

    try {
      this.worker = await createWorker();
      await this.worker.loadLanguage(this.languages);
      await this.worker.initialize(this.languages);
      Logger.success("Tesseract worker initialized successfully");
    } catch (error) {
      Logger.error("Failed to initialize Tesseract worker:", error);
      throw new Error(`Failed to initialize OCR worker: ${(error as Error).message}`);
    }
  }

  /**
   * Extract text from images using Tesseract.js OCR
   */
  async extractTextFromImages(images: PDFImage[]): Promise<OCRResult> {
    Logger.info("🔍 Starting OCR text extraction...");

    if (!this.worker) {
      await this.initializeWorker();
    }

    const pageInfo: Array<{ page: number; text: string }> = [];
    let combinedText = "";

    try {
      for (const image of images) {
        Logger.info(`🔤 Extracting text from page ${image.page}...`);

        try {
          const result = await this.worker!.recognize(image.imagePath);
          const cleanedText = cleanBengaliText(result.data.text);

          if (cleanedText.length > 50) {
            // Only include pages with meaningful content
            pageInfo.push({
              page: image.page,
              text: cleanedText,
            });
            combinedText += cleanedText + "\n\n";

            Logger.success(`Page ${image.page}: ${cleanedText.length} characters extracted`);
            Logger.debug(`Sample: "${cleanedText.substring(0, 100)}..."`);
          } else {
            Logger.warning(`Page ${image.page}: Insufficient text (${cleanedText.length} chars), skipping`);
          }
        } catch (pageError) {
          Logger.error(`Failed to extract text from page ${image.page}:`, pageError);
        }
      }

      Logger.success(`OCR completed: ${pageInfo.length} pages processed`);
      return { text: combinedText, pageInfo };
    } catch (error) {
      Logger.error("Error during OCR text extraction:", error);
      throw new Error(`Failed to extract text from images: ${(error as Error).message}`);
    }
  }

  /**
   * Terminate the OCR worker
   */
  async terminateWorker(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
        this.worker = null;
        Logger.info("🔚 Tesseract worker terminated");
      } catch (terminateError) {
        Logger.warning("Error terminating worker:", terminateError);
      }
    }
  }

  /**
   * Extract text from a single image
   */
  async extractTextFromImage(imagePath: string): Promise<string> {
    if (!this.worker) {
      await this.initializeWorker();
    }

    try {
      const result = await this.worker!.recognize(imagePath);
      return cleanBengaliText(result.data.text);
    } catch (error) {
      Logger.error(`Failed to extract text from image ${imagePath}:`, error);
      throw new Error(`Failed to extract text from image: ${(error as Error).message}`);
    }
  }
}
