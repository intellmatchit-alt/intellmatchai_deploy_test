/**
 * PNME Document Parser Service
 *
 * Extracts text content from PDF documents using pdf-parse.
 * Includes metadata extraction and page counting.
 *
 * @module infrastructure/services/pitch/DocumentParserService
 */

import pdfParse from 'pdf-parse';
import JSZip from 'jszip';
import { IDocumentParserService } from '../../../application/interfaces/IPitchAIService';
import { ExtractedTextDTO } from '../../../application/dto/pitch.dto';
import { logger } from '../../../shared/logger';

/**
 * PDF Magic bytes for validation
 */
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

/**
 * PPTX (ZIP) Magic bytes for validation
 */
const ZIP_MAGIC_BYTES = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // PK..

/**
 * Document Parser Service Implementation
 */
export class DocumentParserService implements IDocumentParserService {
  /**
   * Validate PDF by checking magic bytes
   */
  private validatePDFMagicBytes(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;
    return buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES);
  }

  /**
   * Extract text from a PDF file
   */
  async extractTextFromPDF(buffer: Buffer): Promise<ExtractedTextDTO> {
    // Validate magic bytes
    if (!this.validatePDFMagicBytes(buffer)) {
      throw new Error('Invalid PDF file: magic bytes do not match');
    }

    try {
      // Parse the PDF buffer
      const data = await pdfParse(buffer);

      logger.debug('PDF text extraction completed', {
        pageCount: data.numpages,
        textLength: data.text.length,
        hasMetadata: !!data.info,
      });

      return {
        text: data.text,
        pageCount: data.numpages,
        metadata: {
          title: data.info?.Title || undefined,
          author: data.info?.Author || undefined,
          creationDate: data.info?.CreationDate || undefined,
        },
      };
    } catch (error) {
      logger.error('Failed to parse PDF', {
        error: error instanceof Error ? error.message : 'Unknown error',
        bufferSize: buffer.length,
      });

      if (error instanceof Error && error.message.includes('Invalid')) {
        throw new Error('Corrupted PDF file');
      }

      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate PPTX by checking ZIP magic bytes
   */
  private validatePPTXMagicBytes(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;
    return buffer.subarray(0, 4).equals(ZIP_MAGIC_BYTES);
  }

  /**
   * Extract text from a PPTX file
   */
  async extractTextFromPPTX(buffer: Buffer): Promise<ExtractedTextDTO> {
    if (!this.validatePPTXMagicBytes(buffer)) {
      throw new Error('Invalid PPTX file: magic bytes do not match');
    }

    try {
      const zip = await JSZip.loadAsync(buffer);

      // Find all slide files (ppt/slides/slide1.xml, slide2.xml, etc.)
      const slideFiles: { name: string; index: number }[] = [];
      zip.forEach((relativePath) => {
        const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/);
        if (match) {
          slideFiles.push({ name: relativePath, index: parseInt(match[1], 10) });
        }
      });

      // Sort by slide number
      slideFiles.sort((a, b) => a.index - b.index);

      if (slideFiles.length === 0) {
        throw new Error('No slides found in PPTX file');
      }

      // Extract text from each slide
      const slideTexts: string[] = [];
      for (const slideFile of slideFiles) {
        const file = zip.file(slideFile.name);
        if (!file) continue;

        const xmlContent = await file.async('text');
        const text = this.extractTextFromXML(xmlContent);
        if (text.trim()) {
          slideTexts.push(text.trim());
        }
      }

      const fullText = slideTexts.join('\n\n---\n\n');

      // Extract metadata from docProps/core.xml
      const metadata = await this.extractPPTXMetadata(zip);

      logger.debug('PPTX text extraction completed', {
        slideCount: slideFiles.length,
        textLength: fullText.length,
        hasMetadata: !!metadata.title || !!metadata.author,
      });

      return {
        text: fullText,
        pageCount: slideFiles.length,
        metadata,
      };
    } catch (error) {
      logger.error('Failed to parse PPTX', {
        error: error instanceof Error ? error.message : 'Unknown error',
        bufferSize: buffer.length,
      });

      if (error instanceof Error && error.message.includes('Invalid')) {
        throw error;
      }

      throw new Error(`Failed to extract text from PPTX: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text content from PowerPoint XML
   * Text in PPTX slides is stored in <a:t> tags
   */
  private extractTextFromXML(xml: string): string {
    const texts: string[] = [];

    // Match all <a:t>...</a:t> tags (text runs in PowerPoint XML)
    const textRegex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
    let match;
    while ((match = textRegex.exec(xml)) !== null) {
      const text = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
      texts.push(text);
    }

    // Group texts by paragraph (<a:p> tags)
    // Simple heuristic: join consecutive text runs, separate by newline at paragraph boundaries
    const paragraphRegex = /<a:p[^>]*>([\s\S]*?)<\/a:p>/g;
    const paragraphs: string[] = [];
    let pMatch;
    while ((pMatch = paragraphRegex.exec(xml)) !== null) {
      const pContent = pMatch[1];
      const pTexts: string[] = [];
      const pTextRegex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
      let tMatch;
      while ((tMatch = pTextRegex.exec(pContent)) !== null) {
        const t = tMatch[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        pTexts.push(t);
      }
      if (pTexts.length > 0) {
        paragraphs.push(pTexts.join(''));
      }
    }

    return paragraphs.length > 0 ? paragraphs.join('\n') : texts.join(' ');
  }

  /**
   * Extract metadata from PPTX docProps/core.xml
   */
  private async extractPPTXMetadata(zip: JSZip): Promise<{
    title?: string;
    author?: string;
    creationDate?: string;
  }> {
    const metadata: { title?: string; author?: string; creationDate?: string } = {};

    try {
      const coreFile = zip.file('docProps/core.xml');
      if (coreFile) {
        const xml = await coreFile.async('text');

        const titleMatch = xml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/);
        if (titleMatch) metadata.title = titleMatch[1].trim();

        const authorMatch = xml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/);
        if (authorMatch) metadata.author = authorMatch[1].trim();

        const dateMatch = xml.match(/<dcterms:created[^>]*>([\s\S]*?)<\/dcterms:created>/);
        if (dateMatch) metadata.creationDate = dateMatch[1].trim();
      }
    } catch (err) {
      logger.debug('Could not extract PPTX metadata', { error: err });
    }

    return metadata;
  }
}

// Export singleton instance
export const documentParserService = new DocumentParserService();
