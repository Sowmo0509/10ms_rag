"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Loader2 } from "lucide-react";
import { StatusMessage } from "./StatusMessage";
import type { PageRange, IngestionStatus, IndexStatus } from "./types";

interface IngestionControlProps {
  pageRanges: PageRange[];
  indexStatus: IndexStatus;
}

export function IngestionControl({ pageRanges, indexStatus }: IngestionControlProps) {
  const [ingestionStatus, setIngestionStatus] = useState<IngestionStatus>({ isRunning: false });

  const startIngestion = async () => {
    if (indexStatus !== "exists") {
      setIngestionStatus({
        isRunning: false,
        error: "Please create the Pinecone index first",
      });
      return;
    }

    setIngestionStatus({
      isRunning: true,
      progress: "Starting document ingestion...",
      error: undefined,
      success: undefined,
    });

    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageRanges: pageRanges.length > 0 ? pageRanges : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIngestionStatus({
          isRunning: false,
          success: `Ingestion completed successfully! Processed ${data.chunksProcessed} chunks.`,
          chunksProcessed: data.chunksProcessed,
          indexStats: data.indexStats,
        });
      } else {
        throw new Error(data.error || "Ingestion failed");
      }
    } catch (error) {
      console.error("Ingestion error:", error);
      setIngestionStatus({
        isRunning: false,
        error: `Ingestion failed: ${(error as Error).message}`,
      });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Play className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Document Ingestion</h2>
        </div>

        <Button onClick={startIngestion} disabled={ingestionStatus.isRunning || indexStatus !== "exists"} className="flex items-center space-x-2" size="lg">
          {ingestionStatus.isRunning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
          <span>{ingestionStatus.isRunning ? "Processing..." : "Start Ingestion"}</span>
        </Button>
      </div>

      {/* Status Messages */}
      <div className="space-y-4 mb-6">
        {ingestionStatus.progress && <StatusMessage type="loading" message={ingestionStatus.progress} />}

        {ingestionStatus.error && <StatusMessage type="error" message={ingestionStatus.error} />}

        {ingestionStatus.success && <StatusMessage type="success" message={ingestionStatus.success} details={ingestionStatus.chunksProcessed ? `Chunks processed: ${ingestionStatus.chunksProcessed}` : undefined} />}
      </div>

      {/* Configuration Summary */}
      <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-700">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Current Configuration Summary:</h3>
        <div className="space-y-2">
          {pageRanges.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 italic">All pages will be processed (no specific ranges configured)</p>
          ) : (
            pageRanges.map((range, index) => (
              <div key={index} className="flex items-center space-x-3 text-sm">
                <span className="font-mono bg-gray-200 dark:bg-slate-600 px-2 py-1 rounded">
                  Pages {range.start}-{range.end}
                </span>
                {range.description && <span className="text-gray-600 dark:text-gray-400">{range.description}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
