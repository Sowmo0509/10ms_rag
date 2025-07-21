import { PageRange } from "@/lib/pdf-utils";

/**
 * Configuration for HSC26 PDF page extraction
 *
 * Specify which pages you want to extract and store in the vector database.
 * You can define multiple page ranges with descriptions.
 *
 * Examples:
 * - Single page: { start: 5, end: 5, description: "Chapter 1 Introduction" }
 * - Page range: { start: 10, end: 25, description: "Story: Atithir Smriti" }
 * - Multiple ranges: [{ start: 1, end: 10 }, { start: 50, end: 60 }]
 */

export const HSC26_PAGE_CONFIG: PageRange[] = [
  // Example configurations - modify these according to your needs
  // Option 1: Extract specific story/chapter pages
  // { start: 1, end: 5, description: "Table of Contents" },
  // { start: 10, end: 25, description: "Story: Atithir Smriti" },
  // { start: 26, end: 40, description: "Story: Megh O Roudro" },
  // { start: 41, end: 55, description: "Poetry Section" },
  // Option 2: Extract first 50 pages
  // { start: 1, end: 50, description: "First half of the book" },
  // Option 3: Extract all pages (comment out for all pages)
  // Leave empty array [] to process all pages
];

/**
 * Helper function to create page ranges easily
 */
export function createPageRange(start: number, end: number, description?: string): PageRange {
  return { start, end, description };
}

/**
 * Predefined page configurations for common use cases
 */
export const PREDEFINED_CONFIGS = {
  // Extract first 20 pages (usually contains main stories)
  FIRST_20_PAGES: [createPageRange(1, 20, "First 20 pages - main content")],

  // Extract specific stories (you'll need to adjust page numbers based on your PDF)
  MAIN_STORIES: [createPageRange(5, 15, "Story 1"), createPageRange(16, 25, "Story 2"), createPageRange(26, 35, "Story 3")],

  // Extract poetry section (adjust page numbers as needed)
  POETRY_SECTION: [createPageRange(40, 60, "Poetry and literary pieces")],

  // Sample pages for testing
  SAMPLE_PAGES: [createPageRange(1, 5, "Sample pages for testing")],
};

// Export the configuration you want to use
// Change this to use different predefined configs or your custom HSC26_PAGE_CONFIG
export const ACTIVE_PAGE_CONFIG = HSC26_PAGE_CONFIG;
