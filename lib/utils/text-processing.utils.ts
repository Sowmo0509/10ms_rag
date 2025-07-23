import { Logger } from "./error-handling.utils";

/**
 * Advanced Bengali text cleaning and normalization
 */
export function cleanBengaliText(text: string): string {
  Logger.debug("🧹 Starting Bengali text cleaning...");
  Logger.debug(`📝 Original text sample: "${text.substring(0, 200)}..."`);

  // Step 1: Basic cleanup
  let cleaned = text
    .replace(/\r\n/g, "\n") // Normalize line endings
    .replace(/\r/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // Remove zero-width characters
    .replace(/\u00A0/g, " ") // Replace non-breaking spaces
    .trim();

  // Step 2: Fix Bengali character fragmentation issues
  cleaned = fixBengaliCharacterFragmentation(cleaned);

  // Step 3: Fix common OCR errors in Bengali
  cleaned = fixCommonOCRErrors(cleaned);

  // Step 4: Normalize Unicode to ensure proper rendering
  cleaned = cleaned.normalize("NFC");

  // Step 5: Final cleanup
  cleaned = finalTextCleanup(cleaned);

  Logger.debug(`🔧 After Bengali fixes: "${cleaned.substring(0, 200)}..."`);
  Logger.debug(`📊 Text length: ${text.length} → ${cleaned.length}`);

  return cleaned;
}

/**
 * Fix Bengali character fragmentation issues
 */
function fixBengaliCharacterFragmentation(text: string): string {
  return (
    text
      // Fix broken hasanta (virama) - reconnect consonant clusters
      .replace(/\u09CD\s+/g, "\u09CD") // Remove spaces after hasanta
      .replace(/([ক-হড়ঢ়য়])\s+\u09CD/g, "$1\u09CD") // Remove spaces before hasanta
      .replace(/([ক-হড়ঢ়য়])\u09CD\s+([ক-হড়ঢ়য়])/g, "$1\u09CD$2") // Fix spaces in conjuncts

      // Fix broken vowel marks (kar) - these should attach to consonants
      .replace(/\s+\u09BE/g, "\u09BE") // Fix broken aa-kar (া)
      .replace(/\s+\u09BF/g, "\u09BF") // Fix broken i-kar (ি)
      .replace(/\s+\u09C0/g, "\u09C0") // Fix broken ii-kar (ী)
      .replace(/\s+\u09C1/g, "\u09C1") // Fix broken u-kar (ু)
      .replace(/\s+\u09C2/g, "\u09C2") // Fix broken uu-kar (ূ)
      .replace(/\s+\u09C7/g, "\u09C7") // Fix broken e-kar (ে)
      .replace(/\s+\u09C8/g, "\u09C8") // Fix broken oi-kar (ৈ)
      .replace(/\s+\u09CB/g, "\u09CB") // Fix broken o-kar (ো)
      .replace(/\s+\u09CC/g, "\u09CC") // Fix broken ou-kar (ৌ)
      .replace(/\s+\u09D7/g, "\u09D7")
  ); // Fix broken au length mark (ৗ)
}

/**
 * Fix common OCR errors in Bengali
 */
function fixCommonOCRErrors(text: string): string {
  return (
    text
      // Fix common character confusions
      .replace(/০/g, "০") // Ensure proper Bengali zero
      .replace(/১/g, "১") // Ensure proper Bengali one
      .replace(/২/g, "২") // Ensure proper Bengali two
      .replace(/৩/g, "৩") // Ensure proper Bengali three
      .replace(/৪/g, "৪") // Ensure proper Bengali four
      .replace(/৫/g, "৫") // Ensure proper Bengali five
      .replace(/৬/g, "৬") // Ensure proper Bengali six
      .replace(/৭/g, "৭") // Ensure proper Bengali seven
      .replace(/৮/g, "৮") // Ensure proper Bengali eight
      .replace(/৯/g, "৯") // Ensure proper Bengali nine

      // Fix punctuation
      .replace(/।\s*।/g, "।") // Remove duplicate sentence enders
      .replace(/\?\s*\?/g, "?") // Remove duplicate question marks
      .replace(/!\s*!/g, "!")
  ); // Remove duplicate exclamation marks
}

/**
 * Final text cleanup operations
 */
function finalTextCleanup(text: string): string {
  return text
    .replace(/\n{3,}/g, "\n\n") // Limit consecutive newlines
    .replace(/[ \t]{2,}/g, " ") // Remove excessive spaces
    .replace(/\s+([।,;:!?])/g, "$1") // Remove spaces before punctuation
    .replace(/([।,;:!?])\s*([।,;:!?])/g, "$1$2") // Remove spaces between punctuation
    .trim();
}

/**
 * Split text into sentences (Bengali and English)
 */
export function splitIntoSentences(text: string): string[] {
  return text.split(/(?<=[।.!?])\s+/).filter((sentence) => sentence.trim().length > 0);
}

/**
 * Calculate text overlap between two strings (simple character-based)
 */
export function calculateTextOverlap(text1: string, text2: string): number {
  const shorter = text1.length < text2.length ? text1 : text2;
  const longer = text1.length >= text2.length ? text1 : text2;

  let maxOverlap = 0;
  for (let i = 0; i < shorter.length - 50; i += 10) {
    const substring = shorter.substring(i, i + 100);
    if (longer.includes(substring)) {
      maxOverlap = Math.max(maxOverlap, substring.length);
    }
  }

  return maxOverlap;
}

/**
 * Check if text contains meaningful Bengali content
 */
export function hasMeaningfulBengaliContent(text: string, minLength: number = 50): boolean {
  const bengaliChars = text.match(/[\u0980-\u09FF]/g);
  const bengaliCount = bengaliChars ? bengaliChars.length : 0;
  return text.length >= minLength && bengaliCount > text.length * 0.1; // At least 10% Bengali characters
}

/**
 * Extract Bengali words from text
 */
export function extractBengaliWords(text: string): string[] {
  const bengaliWords = text.match(/[\u0980-\u09FF\s]+/g);
  return bengaliWords ? bengaliWords.map((word) => word.trim()).filter((word) => word.length > 0) : [];
}
