"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Send, MessageCircle, Settings, BarChart3, CheckCircle, AlertCircle, XCircle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  ragEvaluation?: RAGEvaluation;
}

interface RAGEvaluation {
  groundedness: {
    score: number;
    explanation: string;
    supportingEvidence: string[];
  };
  relevance: {
    score: number;
    explanation: string;
    topScores: number[];
    averageScore: number;
  };
  contextUsed: string[];
  retrievalMetrics: {
    totalRetrieved: number;
    aboveThreshold: number;
    averageSimilarity: number;
  };
}

// Component to display evaluation score with color coding
const EvaluationScore = ({ score, label }: { score: number; label: string }) => {
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 0.6) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    if (score >= 0.4) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 0.8) return <CheckCircle className="w-4 h-4" />;
    if (score >= 0.6) return <AlertCircle className="w-4 h-4" />;
    return <XCircle className="w-4 h-4" />;
  };

  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full border ${getScoreColor(score)}`}>
      {getScoreIcon(score)}
      <span className="font-medium">{label}</span>
      <span className="font-bold">{(score * 100).toFixed(0)}%</span>
    </div>
  );
};

// Component to display RAG evaluation details
const RAGEvaluationDisplay = ({ evaluation }: { evaluation: RAGEvaluation }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="mt-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          <span className="font-medium text-gray-900 dark:text-gray-100">RAG Evaluation</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)} className="text-xs">
          {showDetails ? "Hide Details" : "Show Details"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <EvaluationScore score={evaluation.groundedness.score} label="Groundedness" />
        <EvaluationScore score={evaluation.relevance.score} label="Relevance" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <span className="font-medium text-gray-700 dark:text-gray-300">Retrieved:</span>
          <span className="ml-1 text-gray-600 dark:text-gray-400">
            {evaluation.retrievalMetrics.aboveThreshold}/{evaluation.retrievalMetrics.totalRetrieved}
          </span>
        </div>
        <div>
          <span className="font-medium text-gray-700 dark:text-gray-300">Avg Similarity:</span>
          <span className="ml-1 text-gray-600 dark:text-gray-400">{(evaluation.retrievalMetrics.averageSimilarity * 100).toFixed(1)}%</span>
        </div>
        <div>
          <span className="font-medium text-gray-700 dark:text-gray-300">Top Relevance:</span>
          <span className="ml-1 text-gray-600 dark:text-gray-400">{evaluation.relevance.topScores.length > 0 ? (evaluation.relevance.topScores[0] * 100).toFixed(1) + "%" : "N/A"}</span>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 space-y-4 border-t border-gray-200 dark:border-slate-600 pt-4">
          {/* Groundedness Details */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Groundedness Analysis</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{evaluation.groundedness.explanation}</p>
            {evaluation.groundedness.supportingEvidence.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Supporting Evidence:</p>
                <div className="space-y-1">
                  {evaluation.groundedness.supportingEvidence.map((evidence, idx) => (
                    <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-slate-900 p-2 rounded border">
                      {evidence}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Relevance Details */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Relevance Analysis</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{evaluation.relevance.explanation}</p>
            {evaluation.relevance.topScores.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Top Similarity Scores:</p>
                <div className="flex flex-wrap gap-1">
                  {evaluation.relevance.topScores.map((score, idx) => (
                    <span key={idx} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                      {(score * 100).toFixed(1)}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Context Used */}
          {evaluation.contextUsed.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Retrieved Context ({evaluation.contextUsed.length})</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {evaluation.contextUsed.map((context, idx) => (
                  <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-slate-900 p-2 rounded border">
                    <span className="font-medium text-gray-500 dark:text-gray-500">#{idx + 1}:</span> {context}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load chat history from localStorage on component mount
  useEffect(() => {
    const savedMessages = localStorage.getItem("chat_history");
    const savedSessionId = localStorage.getItem("chat_session_id");

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
      } catch (error) {
        console.error("Error parsing saved messages:", error);
      }
    }

    if (savedSessionId) {
      setSessionId(savedSessionId);
    } else {
      // Generate new session ID
      const newSessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      localStorage.setItem("chat_session_id", newSessionId);
    }
  }, []);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("chat_history", JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: input.trim(),
          sessionId: sessionId || undefined,
          chatHistory: messages, // Send current chat history
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      let assistantMessage = "";
      let currentSessionId = sessionId;

      const assistantMessageObj: Message = {
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessageObj]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.sessionId && !currentSessionId) {
                currentSessionId = data.sessionId;
                setSessionId(data.sessionId);
              }

              if (data.content) {
                assistantMessage += data.content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role === "assistant") {
                    lastMessage.content = assistantMessage;
                  }
                  return newMessages;
                });
              }

              if (data.done && data.ragEvaluation) {
                // Add RAG evaluation to the assistant message
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role === "assistant") {
                    lastMessage.ragEvaluation = data.ragEvaluation;
                  }
                  return newMessages;
                });
                break;
              }
            } catch (e) {
              // Ignore parsing errors for malformed chunks
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    try {
      // Clear localStorage
      localStorage.removeItem("chat_history");
      localStorage.removeItem("chat_session_id");

      // Clear state
      setMessages([]);

      // Generate new session ID
      const newSessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      localStorage.setItem("chat_session_id", newSessionId);

      // Call API for compatibility (doesn't do anything server-side now)
      await fetch(`/api/chat?sessionId=${sessionId}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Error clearing chat:", error);
      // Clear locally even if server request fails
      localStorage.removeItem("chat_history");
      localStorage.removeItem("chat_session_id");
      setMessages([]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageCircle className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Bengali RAG Assistant</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Ask questions in Bengali or English • RAG Evaluation Enabled</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button onClick={() => (window.location.href = "/admin")} variant="outline" size="sm" className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Admin</span>
            </Button>

            {messages.length > 0 && (
              <Button onClick={clearChat} variant="outline" size="sm" className="flex items-center space-x-2">
                <Trash2 className="w-4 h-4" />
                <span>Clear Chat</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Welcome to Bengali RAG Assistant</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">Ask questions about the HSC26 Bengali textbook. You can ask in Bengali or English.</p>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 max-w-md mx-auto">
                <div className="flex items-center space-x-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-900 dark:text-blue-100">RAG Evaluation Active</span>
                </div>
                <p className="text-xs text-blue-800 dark:text-blue-200">Each response includes evaluation metrics for groundedness and relevance to help assess answer quality.</p>
              </div>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  <strong>Sample questions:</strong>
                </p>
                <p>• অনুপমের ভাষায় সুপুরুষ কাকে বলা হয়েছে?</p>
                <p>• কাকে অনুপমের ভাগ্য দেবতা বলে উল্লেখ করা হয়েছে?</p>
                <p>• বিয়ের সময় কল্যাণীর প্রকৃত বয়স কত ছিল?</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-4 py-3 ${message.role === "user" ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100"}`}>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    <div className={`text-xs mt-2 ${message.role === "user" ? "text-blue-100" : "text-gray-500 dark:text-gray-400"}`}>{new Date(message.timestamp).toLocaleTimeString()}</div>

                    {/* RAG Evaluation Display */}
                    {message.role === "assistant" && message.ragEvaluation && <RAGEvaluationDisplay evaluation={message.ragEvaluation} />}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <form onSubmit={handleSubmit} className="flex space-x-4">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question in Bengali or English..." disabled={isLoading} className="flex-1" />
            <Button type="submit" disabled={!input.trim() || isLoading} className="flex items-center space-x-2">
              <Send className="w-4 h-4" />
              <span>Send</span>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
