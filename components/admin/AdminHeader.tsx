import { Button } from "@/components/ui/button";
import { Settings, FileText } from "lucide-react";

export function AdminHeader() {
  return (
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
  );
}
