export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

/**
 * Generate chat session ID
 */
export function generateSessionId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Prepare context string for chat completion
 */
export function prepareContextString(contexts: string[]): string {
  return contexts.length > 0 ? `Context information:\n${contexts.join("\n\n")}\n\n` : "";
}

/**
 * Prepare messages for OpenAI chat completion
 */
export function prepareChatMessages(systemPrompt: string, chatHistory: ChatMessage[], query: string, contextString: string): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  return [
    { role: "system", content: systemPrompt },
    ...chatHistory.slice(-10).map((msg: ChatMessage) => ({ role: msg.role, content: msg.content })), // Include recent history
    { role: "user", content: `${contextString}Question: ${query}` },
  ];
}
