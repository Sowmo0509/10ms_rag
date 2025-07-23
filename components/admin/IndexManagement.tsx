"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Database, Plus, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { StatusMessage } from "./StatusMessage";
import type { IndexStatus, IngestionStatus } from "./types";

interface IndexManagementProps {
  onStatusChange?: (status: IndexStatus) => void;
}

export function IndexManagement({ onStatusChange }: IndexManagementProps) {
  const [indexStatus, setIndexStatus] = useState<IndexStatus>("unknown");
  const [ingestionStatus, setIngestionStatus] = useState<IngestionStatus>({ isRunning: false });

  useEffect(() => {
    checkIndexStatus();
  }, []);

  useEffect(() => {
    onStatusChange?.(indexStatus);
  }, [indexStatus, onStatusChange]);

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
      setIndexStatus("exists");
      setIngestionStatus((prev) => ({
        ...prev,
        error: `Failed to recreate index: ${(error as Error).message}`,
        success: undefined,
        progress: undefined,
      }));
    }
  };

  const getStatusDisplay = () => {
    switch (indexStatus) {
      case "exists":
        return { icon: CheckCircle, color: "text-green-500", text: "Ready for ingestion" };
      case "missing":
        return { icon: AlertCircle, color: "text-red-500", text: "Index not found" };
      case "creating":
        return { icon: Loader2, color: "text-blue-500 animate-spin", text: "Creating index..." };
      default:
        return { icon: AlertCircle, color: "text-gray-500", text: "Status unknown" };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center space-x-3 mb-4">
        <Database className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Vector Database Status</h2>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-slate-700">
          <div className="flex items-center space-x-3">
            <statusDisplay.icon className={`w-5 h-5 ${statusDisplay.color}`} />
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Pinecone Index</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{statusDisplay.text}</p>
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

        {/* Status Messages */}
        {ingestionStatus.progress && <StatusMessage type="loading" message={ingestionStatus.progress} />}

        {ingestionStatus.error && <StatusMessage type="error" message={ingestionStatus.error} />}

        {ingestionStatus.success && <StatusMessage type="success" message={ingestionStatus.success} />}

        {/* Index Statistics */}
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
  );
}
