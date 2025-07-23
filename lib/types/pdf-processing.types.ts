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

export interface PDFImage {
  page: number;
  imagePath: string;
}

export interface OCRResult {
  text: string;
  pageInfo: Array<{ page: number; text: string }>;
}

export interface ChunkingOptions {
  chunkSize?: number;
  overlap?: number;
  minChunkSize?: number;
}

export interface PDFProcessingOptions {
  pageRanges?: PageRange[];
  chunkingOptions?: ChunkingOptions;
  ocrLanguages?: string;
}
