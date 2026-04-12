/**
 * Import API
 *
 * API functions for contact import operations.
 *
 * @module lib/api/import
 */

import { api } from './client';

/**
 * Import source types
 */
export type ImportSource = 'PHONE_FULL' | 'PHONE_PICKER' | 'CSV_UPLOAD' | 'VCF_UPLOAD' | 'GOOGLE_SYNC' | 'MANUAL';

/**
 * Import batch status
 */
export type ImportBatchStatus =
  | 'PENDING'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ROLLED_BACK';

/**
 * Import batch data
 */
export interface ImportBatch {
  id: string;
  userId: string;
  source: ImportSource;
  status: ImportBatchStatus;
  consentedAt: string;
  enrichmentEnabled: boolean;
  aiSummaryEnabled: boolean;
  phoneEnrichmentEnabled: boolean;
  currentStage?: string;
  stageProgress: number;
  overallProgress: number;
  totalReceived: number;
  totalImported: number;
  duplicatesMerged: number;
  enrichedCount: number;
  taggedCount: number;
  summarizedCount: number;
  matchedCount: number;
  failedCount: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * Raw contact data from import source
 */
export interface RawContact {
  name?: string;
  title?: string;        // Name prefix (Mr., Dr., etc.)
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  emails?: string[];
  phone?: string;
  phones?: string[];
  company?: string;
  organization?: string;
  jobTitle?: string;
  notes?: string;
  address?: string;
  website?: string;
  linkedIn?: string;
}

/**
 * Create batch input
 */
export interface CreateBatchInput {
  source: ImportSource;
  enrichmentEnabled?: boolean;
  aiSummaryEnabled?: boolean;
  phoneEnrichmentEnabled?: boolean;
}

/**
 * Create batch response
 */
export interface CreateBatchResponse {
  batchId: string;
  status: ImportBatchStatus;
}

/**
 * Upload chunk input
 */
export interface UploadChunkInput {
  chunkIndex: number;
  contacts: RawContact[];
  isLastChunk?: boolean;
}

/**
 * Upload chunk response
 */
export interface UploadChunkResponse {
  batchId: string;
  chunkIndex: number;
  contactsReceived: number;
  totalReceived: number;
}

/**
 * Commit batch response
 */
export interface CommitBatchResponse {
  batchId: string;
  status: ImportBatchStatus;
  jobId?: string;
}

/**
 * Batch status response
 */
export interface BatchStatusResponse {
  batch: ImportBatch;
  stages: {
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
  }[];
}

/**
 * Rollback response
 */
export interface RollbackResponse {
  batchId: string;
  contactsDeleted: number;
  status: ImportBatchStatus;
}

/**
 * List batches response
 */
export interface ListBatchesResponse {
  batches: ImportBatch[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Create a new import batch
 */
export function createImportBatch(input: CreateBatchInput): Promise<CreateBatchResponse> {
  return api.post<CreateBatchResponse>('/contacts/import/batches', input);
}

/**
 * Upload a chunk of contacts to batch
 */
export function uploadChunk(batchId: string, input: UploadChunkInput): Promise<UploadChunkResponse> {
  return api.post<UploadChunkResponse>(`/contacts/import/batches/${batchId}/chunks`, input);
}

/**
 * Commit batch and start processing
 */
export function commitBatch(batchId: string): Promise<CommitBatchResponse> {
  return api.post<CommitBatchResponse>(`/contacts/import/batches/${batchId}/commit`);
}

/**
 * Get batch status
 */
export function getBatchStatus(batchId: string): Promise<BatchStatusResponse> {
  return api.get<BatchStatusResponse>(`/contacts/import/batches/${batchId}/status`);
}

/**
 * Rollback a batch (delete imported contacts)
 */
export function rollbackBatch(batchId: string): Promise<RollbackResponse> {
  return api.post<RollbackResponse>(`/contacts/import/batches/${batchId}/rollback`);
}

/**
 * List import batches
 */
export function listBatches(options?: {
  page?: number;
  limit?: number;
  status?: ImportBatchStatus;
}): Promise<ListBatchesResponse> {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.status) params.set('status', options.status);

  const query = params.toString();
  return api.get<ListBatchesResponse>(`/contacts/import/batches${query ? `?${query}` : ''}`);
}

/**
 * Parse VCF (vCard) file content
 */
export function parseVCF(content: string): RawContact[] {
  const contacts: RawContact[] = [];
  const vcards = content.split(/(?=BEGIN:VCARD)/i);

  console.log('[VCF Parser] Starting parse, found', vcards.length, 'vCard blocks');
  console.log('[VCF Parser] Raw content preview (first 500 chars):', content.substring(0, 500));

  // Helper to get the property name, stripping group prefix (e.g., "item1.FN" -> "FN")
  const getPropertyName = (line: string): string => {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return '';

    let propPart = line.substring(0, colonIndex).toUpperCase();

    // Strip group prefix (e.g., "ITEM1.FN" -> "FN")
    const dotIndex = propPart.indexOf('.');
    if (dotIndex !== -1) {
      propPart = propPart.substring(dotIndex + 1);
    }

    // Get base property name (e.g., "FN;CHARSET=UTF-8" -> "FN")
    const semiIndex = propPart.indexOf(';');
    if (semiIndex !== -1) {
      propPart = propPart.substring(0, semiIndex);
    }

    return propPart;
  };

  // Helper to get the value after the colon
  const getValue = (line: string): string => {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return '';
    return line.substring(colonIndex + 1).trim();
  };

  let vcardIndex = 0;
  for (const vcard of vcards) {
    if (!vcard.trim()) continue;

    vcardIndex++;
    const contact: RawContact = {};
    const lines = vcard.split(/\r?\n/);

    console.log(`[VCF Parser] Processing vCard #${vcardIndex}, lines count:`, lines.length);
    console.log(`[VCF Parser] vCard #${vcardIndex} raw content:`, vcard.substring(0, 300));

    for (const line of lines) {
      const prop = getPropertyName(line);
      const value = getValue(line);

      // Log all name-related lines for debugging
      if (line.toUpperCase().includes('FN') || line.toUpperCase().includes(':N') || prop === 'N' || prop === 'FN') {
        console.log(`[VCF Parser] vCard #${vcardIndex} - Name line found:`, {
          rawLine: line,
          prop,
          value,
          lineLength: line.length
        });
      }

      if (!prop || !value) continue;

      // Parse FN (Full Name)
      if (prop === 'FN') {
        contact.name = value;
        console.log(`[VCF Parser] vCard #${vcardIndex} - Set name from FN:`, value);
      }
      // Parse N (Name components)
      else if (prop === 'N') {
        const nameParts = value.split(';');
        console.log(`[VCF Parser] vCard #${vcardIndex} - N field parts:`, nameParts);
        // N format: LastName;FirstName;MiddleName;Prefix;Suffix
        if (nameParts[0]) contact.lastName = nameParts[0].trim();
        if (nameParts[1]) contact.firstName = nameParts[1].trim();
        if (nameParts[2]) contact.middleName = nameParts[2].trim();
        if (nameParts[3]) contact.title = nameParts[3].trim(); // Prefix like Mr., Dr.
        if (!contact.name && (contact.firstName || contact.lastName)) {
          contact.name = [contact.title, contact.firstName, contact.middleName, contact.lastName]
            .filter(p => p)
            .join(' ')
            .trim();
          console.log(`[VCF Parser] vCard #${vcardIndex} - Built name from N:`, contact.name);
        }
      }
      // Parse EMAIL
      else if (prop === 'EMAIL') {
        if (value) {
          contact.email = contact.email || value;
          contact.emails = contact.emails || [];
          if (!contact.emails.includes(value)) contact.emails.push(value);
        }
      }
      // Parse TEL (Phone)
      else if (prop === 'TEL') {
        if (value) {
          contact.phone = contact.phone || value;
          contact.phones = contact.phones || [];
          if (!contact.phones.includes(value)) contact.phones.push(value);
        }
      }
      // Parse ORG (Organization/Company)
      else if (prop === 'ORG') {
        contact.company = value.split(';')[0].trim();
      }
      // Parse TITLE
      else if (prop === 'TITLE') {
        contact.jobTitle = value;
      }
      // Parse NOTE
      else if (prop === 'NOTE') {
        contact.notes = value;
      }
      // Parse URL
      else if (prop === 'URL') {
        if (value.toLowerCase().includes('linkedin')) {
          contact.linkedIn = value;
        } else {
          contact.website = value;
        }
      }
      // Parse ADR (Address)
      else if (prop === 'ADR') {
        const adrParts = value.split(';');
        contact.address = adrParts.filter(p => p.trim()).join(', ');
      }
    }

    console.log(`[VCF Parser] vCard #${vcardIndex} - Final contact object:`, {
      name: contact.name,
      title: contact.title,
      firstName: contact.firstName,
      middleName: contact.middleName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      company: contact.company
    });

    if (contact.name || contact.email || contact.phone) {
      contacts.push(contact);
      console.log(`[VCF Parser] vCard #${vcardIndex} - ADDED to contacts list`);
    } else {
      console.log(`[VCF Parser] vCard #${vcardIndex} - SKIPPED (no name, email, or phone)`);
    }
  }

  console.log('[VCF Parser] Parse complete. Total contacts:', contacts.length);
  return contacts;
}

/**
 * Parse CSV file content
 */
export function parseCSV(content: string): RawContact[] {
  const contacts: RawContact[] = [];
  const lines = content.split(/\r?\n/).filter(l => l.trim());

  if (lines.length < 2) return contacts;

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

  // Map common header variations
  const headerMap: Record<string, keyof RawContact> = {
    'name': 'name',
    'full name': 'name',
    'fullname': 'name',
    'first name': 'firstName',
    'firstname': 'firstName',
    'first': 'firstName',
    'middle name': 'middleName',
    'middlename': 'middleName',
    'middle': 'middleName',
    'last name': 'lastName',
    'lastname': 'lastName',
    'last': 'lastName',
    'prefix': 'title',
    'name prefix': 'title',
    'salutation': 'title',
    'email': 'email',
    'e-mail': 'email',
    'email address': 'email',
    'phone': 'phone',
    'telephone': 'phone',
    'mobile': 'phone',
    'cell': 'phone',
    'phone number': 'phone',
    'company': 'company',
    'organization': 'organization',
    'org': 'organization',
    'employer': 'company',
    'job title': 'jobTitle',
    'jobtitle': 'jobTitle',
    'title': 'jobTitle',
    'position': 'jobTitle',
    'role': 'jobTitle',
    'notes': 'notes',
    'note': 'notes',
    'website': 'website',
    'url': 'website',
    'linkedin': 'linkedIn',
    'linkedin url': 'linkedIn',
    'address': 'address',
  };

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const contact: RawContact = {};

    headers.forEach((header, index) => {
      const field = headerMap[header];
      const value = values[index]?.trim();

      if (field && value) {
        (contact as Record<string, string>)[field] = value;
      }
    });

    // Build full name if not present
    if (!contact.name && (contact.firstName || contact.lastName)) {
      contact.name = [contact.title, contact.firstName, contact.middleName, contact.lastName]
        .filter(p => p)
        .join(' ')
        .trim();
    }

    // Use organization as company
    if (!contact.company && contact.organization) {
      contact.company = contact.organization;
    }

    if (contact.name || contact.email || contact.phone) {
      contacts.push(contact);
    }
  }

  return contacts;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Check if Contact Picker API is supported
 */
export function isContactPickerSupported(): boolean {
  return typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;
}

/**
 * Check if running in mobile wrapper (Capacitor/React Native)
 */
export function isMobileWrapper(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for Capacitor
  if ((window as unknown as Record<string, unknown>).Capacitor) return true;

  // Check for React Native WebView
  if ((window as unknown as Record<string, unknown>).ReactNativeWebView) return true;

  // Check user agent for common wrapper indicators
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('capacitor') || ua.includes('cordova');
}
