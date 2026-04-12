/**
 * Tesseract OCR Service
 *
 * Local OCR implementation using Tesseract.js.
 * Provides business card text extraction with field parsing.
 *
 * @module infrastructure/external/ocr/TesseractOCRService
 */

import Tesseract from 'tesseract.js';
import { IOCRService, OCRResult, ExtractedCardFields } from '../../../domain/services/IOCRService';
import { logger } from '../../../shared/logger';

/**
 * Regular expressions for field extraction
 */
const FIELD_PATTERNS = {
  /** URL patterns */
  url: /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(?:\.[a-zA-Z]{2,})+(?:\/[^\s]*)?/gi,

  /** LinkedIn URL - expanded patterns to catch OCR variations */
  linkedin: [
    // Standard format
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/gi,
    // Country subdomain format (ae.linkedin.com, uk.linkedin.com, etc.)
    /(?:https?:\/\/)?(?:[a-z]{2}\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/gi,
    // OCR misread: linkedln (i read as l)
    /(?:https?:\/\/)?(?:www\.)?linkedln\.com\/in\/[a-zA-Z0-9_-]+\/?/gi,
    // OCR misread: linkedin with 1 instead of i
    /(?:https?:\/\/)?(?:www\.)?l[i1]nked[i1]n\.com\/[i1]n\/[a-zA-Z0-9_-]+\/?/gi,
    // Just the path portion in case URL is split across lines
    /linkedin\.com\/in\/[a-zA-Z0-9_-]+/gi,
    // Company pages (less common on business cards but possible)
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/company\/[a-zA-Z0-9_-]+\/?/gi,
  ],
};

/**
 * Valid top-level domains (most common)
 */
const VALID_TLDS = [
  'com', 'org', 'net', 'edu', 'gov', 'io', 'co', 'me', 'info', 'biz',
  'ae', 'uk', 'us', 'ca', 'au', 'de', 'fr', 'es', 'it', 'nl', 'be',
  'ch', 'at', 'pl', 'ru', 'jp', 'cn', 'kr', 'in', 'br', 'mx', 'sa',
  'eg', 'qa', 'kw', 'bh', 'om', 'jo', 'lb', 'ps', 'sy', 'iq', 'ye',
];

/**
 * Common OCR character mistakes and their corrections
 */
const OCR_CHAR_FIXES: Record<string, string> = {
  '0': 'o', // zero to letter o
  '1': 'l', // one to letter l
  '|': 'l', // pipe to letter l
  '!': 'i', // exclamation to i
  '$': 's', // dollar to s
  '5': 's', // five to s (in certain contexts)
  '8': 'b', // eight to b (in certain contexts)
  '@': 'a', // only when not in email position
};

/**
 * Words that should NOT appear in a name
 */
const NON_NAME_WORDS = [
  'street', 'road', 'avenue', 'blvd', 'boulevard', 'drive', 'lane', 'way',
  'floor', 'suite', 'building', 'tower', 'plaza', 'center', 'centre',
  'phone', 'tel', 'fax', 'mobile', 'cell', 'email', 'mail', 'web', 'website',
  'address', 'office', 'po box', 'p.o.', 'zip', 'postal',
  'inc', 'llc', 'ltd', 'corp', 'corporation', 'company', 'co.',
  'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

/**
 * Common job title keywords for detection
 */
const JOB_TITLE_KEYWORDS = [
  'CEO', 'CTO', 'CFO', 'COO', 'CIO', 'CMO',
  'President', 'Vice President', 'VP',
  'Director', 'Manager', 'Lead',
  'Engineer', 'Developer', 'Designer',
  'Consultant', 'Analyst', 'Specialist',
  'Executive', 'Officer', 'Head',
  'Founder', 'Co-Founder', 'Partner',
  'Attorney', 'Lawyer', 'Doctor', 'Professor',
];

/**
 * Tesseract OCR Service Implementation
 *
 * Uses Tesseract.js for local OCR processing.
 * Includes intelligent field parsing for business cards.
 */
export class TesseractOCRService implements IOCRService {
  private worker: Tesseract.Worker | null = null;
  private isInitialized = false;

  /**
   * Initialize Tesseract worker with English + Arabic support
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load both English and Arabic languages for multi-language support
      this.worker = await Tesseract.createWorker(['eng', 'ara']);
      this.isInitialized = true;
      logger.info('Tesseract OCR worker initialized with English + Arabic');
    } catch (error) {
      logger.error('Failed to initialize Tesseract worker', { error });
      throw error;
    }
  }

  /**
   * Extract text and fields from a business card image
   *
   * @param imageData - Base64 encoded image data
   * @param mimeType - Image MIME type
   * @returns Extracted fields and metadata
   */
  async extractFromCard(imageData: string, mimeType: string): Promise<OCRResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      await this.initialize();

      if (!this.worker) {
        throw new Error('OCR worker not initialized');
      }

      // Convert base64 to buffer if needed
      const imageBuffer = imageData.startsWith('data:')
        ? imageData
        : `data:${mimeType};base64,${imageData}`;

      // Perform OCR
      const result = await this.worker.recognize(imageBuffer);
      const rawText = result.data.text;
      const confidence = result.data.confidence / 100; // Normalize to 0-1

      logger.debug('OCR completed', {
        textLength: rawText.length,
        confidence,
      });

      // Extract fields from raw text
      const fields = this.parseBusinessCardFields(rawText);
      fields.rawText = rawText;
      fields.confidence = confidence;

      // Add warnings for low confidence or missing fields
      if (confidence < 0.6) {
        warnings.push('Low OCR confidence - results may be inaccurate');
      }
      if (!fields.name) {
        warnings.push('Could not detect name');
      }
      if (!fields.email && !fields.phone) {
        warnings.push('No contact information detected');
      }

      return {
        fields,
        processingTimeMs: Date.now() - startTime,
        engine: 'tesseract',
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      logger.error('OCR extraction failed', { error });
      throw error;
    }
  }

  /**
   * Check if the service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.initialize();
      return this.worker !== null;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup worker resources
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      logger.info('Tesseract OCR worker terminated');
    }
  }

  /**
   * Clean OCR text by removing bullet points and common noise characters
   */
  private cleanOcrText(text: string): string {
    let cleaned = text;

    // Remove common bullet point characters that OCR might pick up
    // These often appear as: •, ·, ●, ○, ▪, ▫, ◦, ◉, ◎, ■, □, ★, ☆, ►, ▶, -, *, >
    const bulletChars = /[•·●○▪▫◦◉◎■□★☆►▶→⁃‣⦿⦾◯⬤⚫⚪🔴🔵]/g;
    cleaned = cleaned.replace(bulletChars, ' ');

    // Remove other common OCR noise characters
    // Characters that often appear as misread bullets or decorations
    const noiseChars = /[¢¤¥§©®™°±²³´µ¶·¸¹º»¼½¾¿×÷˚˙˜˝̧̃̄̈]/g;
    cleaned = cleaned.replace(noiseChars, ' ');

    // OCR often reads bullet ● as letters: d, o, O, D, a, e, c, 0
    // Before @ symbol, these are likely bullets - add space
    cleaned = cleaned.replace(/([doODaec0])(@)/g, ' $2');

    // Before www, these are likely bullets
    cleaned = cleaned.replace(/([doODaec0])(www\.)/gi, ' $2');

    // Before phone numbers starting with 00 or +
    cleaned = cleaned.replace(/([doODaec0])(00\d)/g, ' $2');
    cleaned = cleaned.replace(/([doODaec0])(\+\d)/g, ' $2');

    // Clean up multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ');

    return cleaned;
  }

  /**
   * Clean line prefixes - remove bullets, dashes, and other leading noise
   */
  private cleanLinePrefixes(line: string): string {
    let cleaned = line;

    // Remove leading bullet-like characters and whitespace
    // Common patterns: "• text", "- text", "* text", "> text", "d text" (misread bullet)
    cleaned = cleaned.replace(/^[\s•·●○▪▫◦◉◎■□★☆►▶→⁃‣⦿⦾\-\*\>\|\\\/_]+\s*/, '');

    // Remove single leading character if it looks like OCR noise before actual content
    // Pattern: single non-letter char + space + actual content
    cleaned = cleaned.replace(/^[^a-zA-Z0-9@]\s+/, '');

    // If line starts with a single letter followed by actual word,
    // and that letter looks like misread bullet (d, o, a, etc.), remove it
    // Example: "d cto@email.com" -> "cto@email.com"
    const bulletMisreads = /^[doaODcC]\s+(?=[a-zA-Z0-9]+@)/;
    cleaned = cleaned.replace(bulletMisreads, '');

    // Also handle case where bullet is attached to word
    // Example: "dcto@email.com" where 'd' is a bullet
    // This is handled in fixOcrEmail for emails

    return cleaned.trim();
  }

  /**
   * Extract LinkedIn URL from text with OCR error correction
   */
  private extractLinkedInUrl(rawText: string): string | null {
    // Try each pattern in order
    for (const pattern of FIELD_PATTERNS.linkedin) {
      const matches = rawText.match(pattern);
      if (matches && matches.length > 0) {
        let url = matches[0];

        // Clean and normalize the URL
        url = this.cleanLinkedInUrl(url);

        if (url) {
          logger.debug('LinkedIn URL extracted', { original: matches[0], cleaned: url });
          return url;
        }
      }
    }

    // Fallback: Look for any text containing "linkedin" and try to extract URL
    const linkedinMentions = rawText.match(/[^\s]*linkedin[^\s]*/gi);
    if (linkedinMentions) {
      for (const mention of linkedinMentions) {
        const cleaned = this.cleanLinkedInUrl(mention);
        if (cleaned) {
          logger.debug('LinkedIn URL extracted from mention', { original: mention, cleaned });
          return cleaned;
        }
      }
    }

    // Another fallback: Look for "linkedln" (common OCR mistake)
    const linkedlnMentions = rawText.match(/[^\s]*linkedln[^\s]*/gi);
    if (linkedlnMentions) {
      for (const mention of linkedlnMentions) {
        // Fix the OCR error first
        const fixed = mention.replace(/linkedln/gi, 'linkedin');
        const cleaned = this.cleanLinkedInUrl(fixed);
        if (cleaned) {
          logger.debug('LinkedIn URL extracted from OCR-corrected text', { original: mention, cleaned });
          return cleaned;
        }
      }
    }

    return null;
  }

  /**
   * Clean and normalize a LinkedIn URL
   */
  private cleanLinkedInUrl(url: string): string | null {
    let cleaned = url.toLowerCase().trim();

    // Remove leading bullet characters or noise
    cleaned = cleaned.replace(/^[^a-z0-9]+/, '');

    // Fix common OCR mistakes
    cleaned = cleaned.replace(/linkedln/g, 'linkedin');  // l instead of i
    cleaned = cleaned.replace(/l1nked1n/g, 'linkedin');  // 1 instead of i
    cleaned = cleaned.replace(/llnkedln/g, 'linkedin');  // multiple l/i confusion
    cleaned = cleaned.replace(/\.corn/g, '.com');        // rn instead of m
    cleaned = cleaned.replace(/\.c0m/g, '.com');         // 0 instead of o
    cleaned = cleaned.replace(/\/ln\//g, '/in/');        // l instead of i in path
    cleaned = cleaned.replace(/\/1n\//g, '/in/');        // 1 instead of i in path

    // Ensure it has linkedin.com
    if (!cleaned.includes('linkedin.com')) {
      return null;
    }

    // Extract the profile path
    const inMatch = cleaned.match(/linkedin\.com\/in\/([a-z0-9_-]+)/);
    const companyMatch = cleaned.match(/linkedin\.com\/company\/([a-z0-9_-]+)/);

    if (inMatch) {
      const username = inMatch[1];
      // Validate username (should be reasonable length and format)
      if (username.length >= 2 && username.length <= 100) {
        return `https://linkedin.com/in/${username}`;
      }
    }

    if (companyMatch) {
      const companyName = companyMatch[1];
      if (companyName.length >= 2 && companyName.length <= 100) {
        return `https://linkedin.com/company/${companyName}`;
      }
    }

    return null;
  }

  /**
   * Parse business card text into structured fields
   */
  private parseBusinessCardFields(rawText: string): ExtractedCardFields {
    // Clean the raw text first - remove bullet points and common OCR noise
    const cleanedText = this.cleanOcrText(rawText);

    const lines = cleanedText
      .split('\n')
      .map((line) => this.cleanLinePrefixes(line.trim()))
      .filter((line) => line.length > 0);

    const fields: ExtractedCardFields = {
      rawText,
      confidence: 0,
    };

    // Extract email with enhanced validation
    fields.email = this.extractEmail(cleanedText, lines) || undefined;

    // Extract phone with enhanced validation
    fields.phone = this.extractPhone(cleanedText, lines) || undefined;

    // Extract LinkedIn URL - try multiple patterns and fix OCR errors
    fields.linkedInUrl = this.extractLinkedInUrl(rawText) || undefined;

    // Extract website (excluding LinkedIn)
    const urlMatches = rawText.match(FIELD_PATTERNS.url);
    if (urlMatches) {
      const website = urlMatches.find(
        (url) =>
          !url.toLowerCase().includes('linkedin.com') &&
          !url.toLowerCase().includes('mailto:')
      );
      if (website) {
        fields.website = website.startsWith('http') ? website : `https://${website}`;
      }
    }

    // Extract job title (look for lines with known keywords)
    for (const line of lines) {
      const hasJobKeyword = JOB_TITLE_KEYWORDS.some((keyword) =>
        line.toLowerCase().includes(keyword.toLowerCase())
      );
      if (hasJobKeyword && line.length < 60) {
        fields.jobTitle = this.cleanField(line);
        break;
      }
    }

    // Extract name (usually first prominent line without special characters)
    for (const line of lines) {
      if (this.isLikelyName(line, fields)) {
        fields.name = this.cleanName(line);
        break;
      }
    }

    // Extract company (often after name, before contact info)
    for (const line of lines) {
      if (this.isLikelyCompany(line, fields)) {
        fields.company = this.cleanField(line);
        break;
      }
    }

    return fields;
  }

  /**
   * Extract email from text with strict validation
   */
  private extractEmail(rawText: string, lines: string[]): string | null {
    // Look for email patterns - be very specific
    // Pattern: word characters, dots, hyphens + @ + domain + tld
    const emailPattern = /[a-zA-Z0-9][a-zA-Z0-9._-]{0,30}@[a-zA-Z0-9][a-zA-Z0-9.-]{1,30}\.[a-zA-Z]{2,6}/g;

    const matches: string[] = [];

    // Get matches from raw text
    const rawMatches = rawText.match(emailPattern);
    if (rawMatches) {
      matches.push(...rawMatches);
    }

    // Also check each line for email-like content
    for (const line of lines) {
      const lineMatches = line.match(emailPattern);
      if (lineMatches) {
        matches.push(...lineMatches);
      }
    }

    // Also try to find emails by looking for @ symbol and extracting around it
    const atPositions = [...rawText.matchAll(/@/g)];
    for (const atMatch of atPositions) {
      if (atMatch.index !== undefined) {
        // Extract text around the @ symbol
        const start = Math.max(0, atMatch.index - 35);
        const end = Math.min(rawText.length, atMatch.index + 35);
        const segment = rawText.slice(start, end);

        // Try to extract email from this segment
        const segmentMatches = segment.match(emailPattern);
        if (segmentMatches) {
          matches.push(...segmentMatches);
        }
      }
    }

    // Validate and score each match, also try variations
    let bestEmail: string | null = null;
    let bestScore = 0;

    for (const match of matches) {
      // Try the original match
      const result = this.validateEmail(match);
      if (result && result.score > bestScore) {
        bestEmail = result.email;
        bestScore = result.score;
      }

      // Also try with first character removed (in case of attached bullet)
      if (match.length > 5) {
        const withoutFirst = match.slice(1);
        const result2 = this.validateEmail(withoutFirst);
        if (result2 && result2.score > bestScore) {
          bestEmail = result2.email;
          bestScore = result2.score;
        }
      }
    }

    return bestEmail;
  }

  /**
   * Validate and clean a single email
   */
  private validateEmail(raw: string): { email: string; score: number } | null {
    // Clean the email
    let email = raw.toLowerCase().trim();

    // Remove any leading/trailing garbage (bullets, spaces, special chars)
    email = email.replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]+$/, '');

    // Fix common OCR mistakes in email
    email = this.fixOcrEmail(email);

    // Must have exactly one @
    const atCount = (email.match(/@/g) || []).length;
    if (atCount !== 1) return null;

    let [local, domain] = email.split('@');

    // Try to fix local part if it starts with a suspicious single character
    // that might be a misread bullet point (d, o, a, c, etc.)
    // OCR reads ● as: d, o, O, D, a, e, c, 0, Q, @
    const suspiciousPrefixes = ['d', 'o', 'a', 'c', 'q', 'e', 'i', 'l', 'j', '0'];
    if (local.length > 2) {
      const firstChar = local[0];
      const rest = local.slice(1);

      // If first char is suspicious and rest forms a valid-looking local part
      if (suspiciousPrefixes.includes(firstChar)) {
        // Check if the rest looks more like a proper email prefix
        const commonPrefixes = ['ceo', 'cto', 'cfo', 'coo', 'cio', 'cmo', 'info', 'admin', 'hello', 'sales', 'support', 'contact', 'hr', 'marketing', 'office', 'team', 'mail', 'enquiry', 'enquiries', 'service', 'help'];

        // Direct match
        for (const prefix of commonPrefixes) {
          if (rest === prefix || rest.startsWith(prefix + '.') || rest.startsWith(prefix + '_')) {
            local = rest;
            email = local + '@' + domain;
            break;
          }
        }

        // Also check if removing first char makes it start with a letter (not number)
        if (local !== rest && /^[a-z]/.test(rest) && rest.length >= 2) {
          // The rest starts with a letter and is reasonable length
          // Likely the first char was a bullet
          local = rest;
          email = local + '@' + domain;
        }
      }
    }

    // Local part validation
    if (!local || local.length < 1 || local.length > 40) return null;
    if (!/^[a-z0-9]/.test(local)) return null; // Must start with alphanumeric
    if (/[._-]{2,}/.test(local)) return null; // No consecutive special chars
    if (/[^a-z0-9._-]/.test(local)) return null; // Only valid chars

    // Domain validation
    if (!domain || domain.length < 4 || domain.length > 40) return null;
    if (!domain.includes('.')) return null;

    const domainParts = domain.split('.');
    if (domainParts.length < 2) return null;

    // Check each domain part
    for (const part of domainParts) {
      if (part.length < 1 || part.length > 20) return null;
      if (/[^a-z0-9-]/.test(part)) return null;
      if (/^-|-$/.test(part)) return null; // Can't start/end with hyphen
    }

    const tld = domainParts[domainParts.length - 1];

    // TLD must be valid
    if (tld.length < 2 || tld.length > 6) return null;
    if (!/^[a-z]+$/.test(tld)) return null;

    // Calculate confidence score
    let score = 50;

    // Boost for known TLDs
    if (VALID_TLDS.includes(tld)) score += 30;

    // Boost for reasonable local part (not just random chars)
    if (/^[a-z]+[a-z0-9._-]*$/.test(local)) score += 10;

    // Boost for no numbers in domain (except TLD like co.uk)
    if (!/[0-9]/.test(domainParts.slice(0, -1).join('.'))) score += 10;

    return { email, score };
  }

  /**
   * Fix common OCR mistakes in email addresses
   */
  private fixOcrEmail(email: string): string {
    // Common OCR substitutions in emails
    const fixes: [RegExp, string][] = [
      [/[|l](?=@)/, 'l'],      // pipe/l before @
      [/0(?=[a-z])/g, 'o'],    // zero followed by letter -> o
      [/(?<=[a-z])0/g, 'o'],   // zero after letter -> o
      [/1(?=[a-z])/g, 'l'],    // one followed by letter -> l
      [/(?<=[a-z])1/g, 'l'],   // one after letter -> l
      [/rn/g, 'm'],            // rn -> m (common OCR mistake)
      [/vv/g, 'w'],            // vv -> w
      [/\.corn$/i, '.com'],    // .corn -> .com
      [/\.c0m$/i, '.com'],     // .c0m -> .com
      [/\.cornm$/i, '.com'],   // .cornm -> .com
      [/grnail/gi, 'gmail'],   // grnail -> gmail
      [/gmai1/gi, 'gmail'],    // gmai1 -> gmail
      [/hotrnail/gi, 'hotmail'], // hotrnail -> hotmail
      [/yah00/gi, 'yahoo'],    // yah00 -> yahoo
      [/outl00k/gi, 'outlook'], // outl00k -> outlook
    ];

    let fixed = email;
    for (const [pattern, replacement] of fixes) {
      fixed = fixed.replace(pattern, replacement);
    }

    // Fix common prefix mistakes (OCR adding extra chars)
    // dcto@ -> cto@, aceo@ -> ceo@, etc.
    const localPart = fixed.split('@')[0];
    const domain = fixed.split('@')[1];

    if (localPart && domain) {
      // Check for common job title email prefixes with noise
      const commonPrefixes = ['ceo', 'cto', 'cfo', 'coo', 'cio', 'cmo', 'info', 'admin', 'contact', 'hello', 'sales', 'support', 'hr'];
      for (const prefix of commonPrefixes) {
        // If local part is prefix with 1 extra char at start, fix it
        if (localPart.length === prefix.length + 1 && localPart.endsWith(prefix)) {
          fixed = prefix + '@' + domain;
          break;
        }
        // If local part is prefix with 1 extra char at end before @, fix it
        if (localPart.length === prefix.length + 1 && localPart.startsWith(prefix)) {
          fixed = prefix + '@' + domain;
          break;
        }
      }
    }

    return fixed;
  }

  /**
   * Extract phone number from text with strict validation
   */
  private extractPhone(rawText: string, lines: string[]): string | null {
    // Look for lines that likely contain phone numbers
    const phoneIndicators = ['phone', 'tel', 'mobile', 'cell', 'fax', 'ph:', 'ph.', 't:', 'm:', 'c:'];

    let candidates: string[] = [];

    // First, look for lines with phone indicators
    for (const line of lines) {
      const lineLower = line.toLowerCase();
      const hasIndicator = phoneIndicators.some(ind => lineLower.includes(ind));

      if (hasIndicator) {
        // Extract number from this line
        const numbers = this.extractPhoneFromLine(line);
        candidates.push(...numbers);
      }
    }

    // If no indicator-based phones found, look for standalone phone patterns
    if (candidates.length === 0) {
      for (const line of lines) {
        // Skip lines that look like emails or URLs
        if (line.includes('@') || line.includes('www') || line.includes('http')) continue;

        const numbers = this.extractPhoneFromLine(line);
        candidates.push(...numbers);
      }
    }

    // Validate and return the best phone number
    for (const candidate of candidates) {
      const validated = this.validatePhone(candidate);
      if (validated) return validated;
    }

    return null;
  }

  /**
   * Extract potential phone numbers from a line
   */
  private extractPhoneFromLine(line: string): string[] {
    const results: string[] = [];

    // Pattern for phone numbers with various formats
    // Matches: +971 50 123 4567, (050) 123-4567, 050.123.4567, 0501234567
    const patterns = [
      /\+?\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{0,4}/g,
    ];

    for (const pattern of patterns) {
      const matches = line.match(pattern) || [];
      results.push(...matches);
    }

    return results;
  }

  /**
   * Validate and format a phone number
   */
  private validatePhone(raw: string): string | null {
    // Clean the raw input first
    let cleaned = raw.trim();

    // Remove leading characters that might be misread bullets (d, o, a, c, etc.)
    // but only if followed by digits
    cleaned = cleaned.replace(/^[doODaecqlj]\s*(?=\d)/i, '');

    // Extract only digits and leading +
    const hasPlus = cleaned.startsWith('+');
    let digits = cleaned.replace(/\D/g, '');

    // If starts with 000 (like 00962), it might have an extra 0 from bullet
    // Jordan country code is 00962 or +962
    if (digits.startsWith('000') && digits.length > 12) {
      // Likely extra 0 from bullet, remove one
      digits = digits.slice(1);
    }

    // Must have 7-15 digits
    if (digits.length < 7 || digits.length > 15) return null;

    // Reject patterns that are clearly not phone numbers

    // All same digit
    if (/^(\d)\1+$/.test(digits)) return null;

    // Sequential numbers (1234567, 7654321)
    if (this.isSequentialNumber(digits)) return null;

    // Looks like a year
    if (/^(19|20)\d{2}$/.test(digits)) return null;

    // Looks like a date (YYYYMMDD)
    if (/^(19|20)\d{6}$/.test(digits)) return null;

    // Too many repeated digits (like 111222333)
    if (/(\d)\1{3,}/.test(digits)) return null;

    // Starts with 0000 or similar (4+ zeros)
    if (/^0{4,}/.test(digits)) return null;

    // Format the output
    // Check for international format starting with 00
    if (digits.startsWith('00') && digits.length >= 12) {
      // International format with 00 prefix (e.g., 00962797324995)
      // Format: +962 79 732 4995
      const countryCode = digits.slice(2, 5); // 962
      const rest = digits.slice(5);
      if (rest.length >= 9) {
        return '+' + countryCode + ' ' + rest.slice(0, 2) + ' ' + rest.slice(2, 5) + ' ' + rest.slice(5);
      }
      return '+' + countryCode + ' ' + rest;
    } else if (hasPlus || digits.length > 10) {
      // International format - add + and format nicely
      if (digits.length >= 12) {
        // Format: +XXX XX XXX XXXX
        return '+' + digits.slice(0, 3) + ' ' + digits.slice(3, 5) + ' ' + digits.slice(5, 8) + ' ' + digits.slice(8);
      } else if (digits.length >= 10) {
        // Format: +XXX XXXXXXX
        return '+' + digits.slice(0, 3) + ' ' + digits.slice(3);
      }
      return '+' + digits;
    } else if (digits.length === 10) {
      // US format: (XXX) XXX-XXXX
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 9) {
      // Format: XXX-XXX-XXX
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 8) {
      // Format: XXXX-XXXX
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    } else if (digits.length === 7) {
      // Format: XXX-XXXX
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }

    return digits;
  }

  /**
   * Check if a number is sequential (like 1234567 or 7654321)
   */
  private isSequentialNumber(num: string): boolean {
    if (num.length < 5) return false;

    let ascending = true;
    let descending = true;

    for (let i = 1; i < num.length; i++) {
      const diff = parseInt(num[i]) - parseInt(num[i - 1]);
      if (diff !== 1) ascending = false;
      if (diff !== -1) descending = false;
    }

    return ascending || descending;
  }

  /**
   * Clean and validate name
   */
  private cleanName(value: string): string {
    let name = value
      .replace(/[|]/g, 'I') // Common OCR mistake
      .replace(/[0-9]/g, '') // Remove numbers from names
      .replace(/[^\w\s'-]/g, '') // Keep only letters, spaces, hyphens, apostrophes
      .replace(/\s+/g, ' ')
      .trim();

    // Capitalize each word properly
    name = name
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // If name is too short after cleaning, return empty
    if (name.length < 2) return '';

    // If name has more than 4 words, likely not a name
    if (name.split(' ').length > 4) return '';

    return name;
  }

  /**
   * Check if a line is likely a person's name
   */
  private isLikelyName(line: string, existingFields: Partial<ExtractedCardFields>): boolean {
    // Skip if already identified as something else
    if (
      line === existingFields.email ||
      line === existingFields.phone ||
      line === existingFields.company ||
      line === existingFields.jobTitle
    ) {
      return false;
    }

    const lineLower = line.toLowerCase();

    // Names typically don't contain these
    if (
      line.includes('@') ||
      line.includes('www') ||
      line.includes('http') ||
      line.includes('.com') ||
      line.includes('.net') ||
      line.includes('.org') ||
      /\d{3,}/.test(line) // 3+ consecutive digits
    ) {
      return false;
    }

    // Check for non-name words (addresses, dates, company terms, etc.)
    for (const word of NON_NAME_WORDS) {
      if (lineLower.includes(word)) {
        return false;
      }
    }

    // Skip lines that look like phone numbers
    if (/[\(\)\+]/.test(line) && /\d/.test(line)) {
      return false;
    }

    // Skip lines with too many special characters
    const specialCharCount = (line.match(/[^a-zA-Z\s'-]/g) || []).length;
    if (specialCharCount > 2) {
      return false;
    }

    // Names are usually 1-4 words (allow single names like "Madonna")
    const words = line.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 1 || words.length > 4) return false;

    // Each word should be mostly letters and reasonable length
    for (const word of words) {
      // Skip very short words unless they're common name parts
      if (word.length < 2 && !['A', 'J', 'D', 'O'].includes(word.toUpperCase())) {
        return false;
      }
      // Words shouldn't be too long
      if (word.length > 20) return false;
      // Words should be mostly letters
      const letterCount = (word.match(/[a-zA-Z]/g) || []).length;
      if (letterCount / word.length < 0.8) return false;
    }

    // Most characters should be letters
    const letterRatio = (line.match(/[a-zA-Z]/g) || []).length / line.length;
    if (letterRatio < 0.85) return false;

    // Reasonable length for a name (allow shorter names)
    if (line.length < 2 || line.length > 40) return false;

    // Names typically start with a capital letter
    if (!/^[A-Z]/.test(line.trim())) return false;

    return true;
  }

  /**
   * Check if a line is likely a company name
   */
  private isLikelyCompany(line: string, existingFields: Partial<ExtractedCardFields>): boolean {
    // Skip if already identified or same as name
    if (
      line === existingFields.name ||
      line === existingFields.email ||
      line === existingFields.phone ||
      line === existingFields.jobTitle
    ) {
      return false;
    }

    // Skip URLs and email-like strings
    if (
      line.includes('@') ||
      line.includes('www') ||
      line.includes('http')
    ) {
      return false;
    }

    // Company names often have these patterns
    const companyIndicators = [
      'Inc', 'LLC', 'Ltd', 'Corp', 'Co.',
      'Group', 'Holdings', 'Partners',
      'Solutions', 'Services', 'Technologies',
      'Consulting', 'Agency', 'Studio',
    ];

    const hasIndicator = companyIndicators.some((ind) =>
      line.toLowerCase().includes(ind.toLowerCase())
    );

    // If has company indicator, likely a company
    if (hasIndicator && line.length < 80) return true;

    // Otherwise, look for capitalized words that aren't the name
    if (
      existingFields.name &&
      line !== existingFields.name &&
      line.length > 3 &&
      line.length < 60 &&
      /^[A-Z]/.test(line)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Clean extracted field value
   */
  private cleanField(value: string): string {
    return value
      .replace(/[|]/g, 'I') // Common OCR mistake
      .replace(/[0O]/g, (match, offset, str) => {
        // Keep O in names, 0 in numbers
        const context = str.slice(Math.max(0, offset - 1), offset + 2);
        return /\d/.test(context) ? '0' : match;
      })
      .replace(/\s+/g, ' ')
      .trim();
  }
}
