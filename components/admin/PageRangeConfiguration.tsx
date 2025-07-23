"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Plus, Trash2 } from "lucide-react";
import type { PageRange } from "./types";

interface PageRangeConfigurationProps {
  pageRanges: PageRange[];
  onPageRangesChange: (ranges: PageRange[]) => void;
}

export function PageRangeConfiguration({ pageRanges, onPageRangesChange }: PageRangeConfigurationProps) {
  const addPageRange = () => {
    onPageRangesChange([...pageRanges, { start: 1, end: 10, description: "" }]);
  };

  const updatePageRange = (index: number, field: keyof PageRange, value: string | number) => {
    const updated = [...pageRanges];
    if (field === "start" || field === "end") {
      updated[index][field] = parseInt(value as string) || 1;
    } else {
      updated[index][field] = value as string;
    }
    onPageRangesChange(updated);
  };

  const removePageRange = (index: number) => {
    onPageRangesChange(pageRanges.filter((_, i) => i !== index));
  };

  const applyPredefinedConfig = (config: PageRange[]) => {
    onPageRangesChange([...config]);
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
  );
}
