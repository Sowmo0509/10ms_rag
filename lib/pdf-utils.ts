import pdf from 'pdf-parse';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface DocumentChunk {
  content: string;
  metadata: {
    source: string;
    page?: number;
    chunk_index: number;
    char_count: number;
  };
}

/**
 * Extract text content from a PDF file
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Clean and normalize text for better processing
 * Handles Bengali text preprocessing
 */
export function cleanText(text: string): string {
  // Remove excessive whitespace and normalize
  let cleaned = text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
    .replace(/[ \t]{2,}/g, ' ') // Remove excessive spaces
    .trim();

  // Handle Bengali-specific cleaning
  cleaned = cleaned
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
    .replace(/[\u0981\u09BC]/g, '') // Remove certain Bengali diacritics that might cause issues
    .trim();

  return cleaned;
}

/**
 * Split text into chunks with overlap for better context preservation
 * Optimized for Bengali text boundaries
 */
export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): DocumentChunk[] {
  const cleanedText = cleanText(text);
  const chunks: DocumentChunk[] = [];
  
  // Split by sentences first (looking for Bengali and English sentence endings)
  const sentences = cleanedText.split(/(?<=[।.!?])\s+/);
  
  let currentChunk = '';
  let chunkIndex = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    
    // If adding this sentence would exceed chunk size, finalize current chunk
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            source: 'hsc26.pdf',
            chunk_index: chunkIndex,
            char_count: currentChunk.trim().length,
          },
        });
        chunkIndex++;
      }
      
      // Start new chunk with overlap from previous chunk
      const words = currentChunk.trim().split(/\s+/);
      const overlapWords = words.slice(-Math.floor(overlap / 6)); // Approximate word count for overlap
      currentChunk = overlapWords.join(' ') + ' ' + sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        source: 'hsc26.pdf',
        chunk_index: chunkIndex,
        char_count: currentChunk.trim().length,
      },
    });
  }
  
  // Filter out very short chunks (less than 50 characters)
  return chunks.filter(chunk => chunk.content.length >= 50);
}

/**
 * Process the HSC26 PDF file and return document chunks
 */
export async function processHSC26PDF(): Promise<DocumentChunk[]> {
  try {
    const pdfPath = join(process.cwd(), 'public', 'files', 'hsc26.pdf');
    console.log('Processing PDF at:', pdfPath);
    
    const text = await extractTextFromPDF(pdfPath);
    console.log(`Extracted ${text.length} characters from PDF`);
    
    const chunks = chunkText(text, 1000, 200);
    console.log(`Created ${chunks.length} chunks`);
    
    return chunks;
  } catch (error) {
    console.error('Error processing HSC26 PDF:', error);
    throw error;
  }
} 