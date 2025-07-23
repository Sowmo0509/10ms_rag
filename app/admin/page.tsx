"use client";

import { useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { IndexManagement } from "@/components/admin/IndexManagement";
import { PageRangeConfiguration } from "@/components/admin/PageRangeConfiguration";
import { IngestionControl } from "@/components/admin/IngestionControl";
import type { PageRange, IndexStatus } from "@/components/admin/types";

export default function AdminPage() {
  const [pageRanges, setPageRanges] = useState<PageRange[]>([{ start: 1, end: 20, description: "First 20 pages" }]);
  const [indexStatus, setIndexStatus] = useState<IndexStatus>("unknown");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <AdminHeader />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <IndexManagement onStatusChange={setIndexStatus} />
          <PageRangeConfiguration pageRanges={pageRanges} onPageRangesChange={setPageRanges} />
        </div>

        <div className="mt-8">
          <IngestionControl pageRanges={pageRanges} indexStatus={indexStatus} />
        </div>
      </div>
    </div>
  );
}
