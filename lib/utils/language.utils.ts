/**
 * Detect if text is primarily Bengali
 */
export function isBengali(text: string): boolean {
  const bengaliChars = text.match(/[\u0980-\u09FF]/g);
  const totalChars = text.replace(/\s/g, "").length;
  return bengaliChars ? bengaliChars.length / totalChars > 0.3 : false;
}

/**
 * Get system prompt based on language detection
 */
export function getSystemPrompt(text: string): string {
  const isUserBengali = isBengali(text);

  return isUserBengali ? `আপনি একটি সহায়ক AI সহায়ক। আপনাকে দেওয়া প্রসঙ্গের ভিত্তিতে প্রশ্নের উত্তর দিন। যদি প্রসঙ্গে উত্তর না থাকে, তাহলে বিনয়ের সাথে বলুন যে আপনি জানেন না। সবসময় বাংলায় উত্তর দিন।` : `You are a helpful AI assistant. Answer questions based on the provided context. If the answer is not in the context, politely say you don't know. Always respond in English.`;
}

/**
 * Extract Bengali keywords from text for keyword-based search fallback
 */
export function extractBengaliKeywords(text: string): string[] {
  return text.match(/[\u0980-\u09FF]+/g) || [];
}
