"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, FileText, Database, Plus, Trash2, Play, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface PageRange {
  start: number;
  end: number;
  description?: string;
}

interface IngestionStatus {
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

export default function AdminPage() {
  const [pageRanges, setPageRanges] = useState<PageRange[]>([{ start: 1, end: 20, description: "First 20 pages" }]);
  const [indexStatus, setIndexStatus] = useState<"unknown" | "exists" | "missing" | "creating">("unknown");
  const [ingestionStatus, setIngestionStatus] = useState<IngestionStatus>({ isRunning: false });

  // Check index status on component mount
  useEffect(() => {
    checkIndexStatus();
  }, []);

  const checkIndexStatus = async () => {
    try {
      const response = await fetch("/api/create-index", { method: "POST" });
      const data = await response.json();

      if (data.message?.includes("already exists")) {
        setIndexStatus("exists");
      } else if (data.message?.includes("created successfully")) {
        setIndexStatus("exists");
      } else {
        setIndexStatus("missing");
      }
    } catch (error) {
      console.error("Error checking index status:", error);
      setIndexStatus("unknown");
    }
  };

  const createIndex = async () => {
    setIndexStatus("creating");
    try {
      const response = await fetch("/api/create-index", { method: "POST" });
      const data = await response.json();

      if (response.ok) {
        setIndexStatus("exists");
        setIngestionStatus((prev) => ({
          ...prev,
          success: "Index created successfully!",
          error: undefined,
        }));
      } else {
        throw new Error(data.error || "Failed to create index");
      }
    } catch (error) {
      console.error("Error creating index:", error);
      setIndexStatus("missing");
      setIngestionStatus((prev) => ({
        ...prev,
        error: `Failed to create index: ${(error as Error).message}`,
        success: undefined,
      }));
    }
  };

  const recreateIndex = async () => {
    setIndexStatus("creating");
    setIngestionStatus((prev) => ({
      ...prev,
      progress: "Recreating index with correct dimensions...",
      error: undefined,
      success: undefined,
    }));

    try {
      const response = await fetch("/api/recreate-index", { method: "POST" });
      const data = await response.json();

      if (response.ok) {
        setIndexStatus("exists");
        setIngestionStatus((prev) => ({
          ...prev,
          success: `Index recreated successfully with ${data.dimension} dimensions!`,
          error: undefined,
          progress: undefined,
        }));
      } else {
        throw new Error(data.error || "Failed to recreate index");
      }
    } catch (error) {
      console.error("Error recreating index:", error);
      setIndexStatus("exists"); // Keep as exists since it might still be there
      setIngestionStatus((prev) => ({
        ...prev,
        error: `Failed to recreate index: ${(error as Error).message}`,
        success: undefined,
        progress: undefined,
      }));
    }
  };

  const addPageRange = () => {
    setPageRanges([...pageRanges, { start: 1, end: 10, description: "" }]);
  };

  const updatePageRange = (index: number, field: keyof PageRange, value: string | number) => {
    const updated = [...pageRanges];
    if (field === "start" || field === "end") {
      updated[index][field] = parseInt(value as string) || 1;
    } else {
      updated[index][field] = value as string;
    }
    setPageRanges(updated);
  };

  const removePageRange = (index: number) => {
    setPageRanges(pageRanges.filter((_, i) => i !== index));
  };

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

  const applyPredefinedConfig = (config: PageRange[]) => {
    setPageRanges([...config]);
  };

  const predefinedConfigs = {
    "First 20 Pages": [{ start: 1, end: 20, description: "First 20 pages" }],
    "Sample Pages": [{ start: 1, end: 5, description: "Sample pages for testing" }],
    "Main Stories": [
      { start: 5, end: 15, description: "Story 1" },
      { start: 16, end: 25, description: "Story 2" },
      { start: 26, end: 35, description: "Story 3" },
    ],
    "Poetry Section": [{ start: 40, end: 60, description: "Poetry and literary pieces" }],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Settings className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">RAG System Administration</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Configure PDF ingestion and manage vector database</p>
            </div>
          </div>
          <Button onClick={() => (window.location.href = "/")} variant="outline" className="flex items-center space-x-2">
            <FileText className="w-4 h-4" />
            <span>Back to Chat</span>
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Index Management */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Database className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Vector Database Status</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-slate-700">
                <div className="flex items-center space-x-3">
                  {indexStatus === "exists" && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {indexStatus === "missing" && <AlertCircle className="w-5 h-5 text-red-500" />}
                  {indexStatus === "creating" && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
                  {indexStatus === "unknown" && <AlertCircle className="w-5 h-5 text-gray-500" />}

                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Pinecone Index</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {indexStatus === "exists" && "Ready for ingestion"}
                      {indexStatus === "missing" && "Index not found"}
                      {indexStatus === "creating" && "Creating index..."}
                      {indexStatus === "unknown" && "Status unknown"}
                    </p>
                  </div>
                </div>

                {indexStatus === "missing" && (
                  <Button onClick={createIndex} className="flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Create Index</span>
                  </Button>
                )}

                {indexStatus === "exists" && (
                  <Button onClick={recreateIndex} variant="outline" className="flex items-center space-x-2 text-orange-600 border-orange-600 hover:bg-orange-50">
                    <Database className="w-4 h-4" />
                    <span>Recreate Index</span>
                  </Button>
                )}
              </div>

              {ingestionStatus.indexStats && (
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Index Statistics</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700 dark:text-blue-300">Total Vectors:</span>
                      <span className="ml-2 font-mono">{ingestionStatus.indexStats.totalVectors}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 dark:text-blue-300">Dimensions:</span>
                      <span className="ml-2 font-mono">{ingestionStatus.indexStats.dimension}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Page Range Configuration */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">PDF Page Configuration</h2>
              </div>
              <Button onClick={addPageRange} size="sm" variant="outline" className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Add Range</span>
              </Button>
            </div>

            {/* Predefined Configurations */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Configurations:</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(predefinedConfigs).map(([name, config]) => (
                  <Button key={name} onClick={() => applyPredefinedConfig(config)} variant="outline" size="sm" className="text-xs">
                    {name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Page Ranges */}
            <div className="space-y-4">
              {pageRanges.map((range, index) => (
                <div key={index} className="p-4 rounded-lg bg-gray-50 dark:bg-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Range {index + 1}</h4>
                    {pageRanges.length > 1 && (
                      <Button onClick={() => removePageRange(index)} size="sm" variant="ghost" className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Page</label>
                      <Input type="number" value={range.start} onChange={(e) => updatePageRange(index, "start", e.target.value)} min="1" className="w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Page</label>
                      <Input type="number" value={range.end} onChange={(e) => updatePageRange(index, "end", e.target.value)} min="1" className="w-full" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
                    <Input type="text" value={range.description || ""} onChange={(e) => updatePageRange(index, "description", e.target.value)} placeholder="e.g., Chapter 1, Story section..." className="w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ingestion Control */}
        <div className="mt-8 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
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
          {ingestionStatus.progress && (
            <div className="mb-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="text-blue-800 dark:text-blue-200">{ingestionStatus.progress}</span>
              </div>
            </div>
          )}

          {ingestionStatus.error && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-800 dark:text-red-200">{ingestionStatus.error}</span>
              </div>
            </div>
          )}

          {ingestionStatus.success && (
            <div className="mb-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-800 dark:text-green-200">{ingestionStatus.success}</span>
              </div>
              {ingestionStatus.chunksProcessed && <div className="mt-2 text-sm text-green-700 dark:text-green-300">Chunks processed: {ingestionStatus.chunksProcessed}</div>}
            </div>
          )}

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
      </div>
    </div>
  );
}
