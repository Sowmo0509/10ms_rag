export interface PageRange {
  start: number;
  end: number;
  description?: string;
}

export interface IngestionStatus {
  isRunning: boolean;
  progress?: string;
  error?: string;
  success?: string;
  chunksProcessed?: number;
  indexStats?: {
    totalVectors: number;
    dimension: number;
  };
}

export type IndexStatus = "unknown" | "exists" | "missing" | "creating";
