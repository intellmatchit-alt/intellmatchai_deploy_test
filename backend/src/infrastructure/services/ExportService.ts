/**
 * Export Service
 *
 * Handles exporting contacts to various formats (CSV, vCard).
 *
 * @module infrastructure/services/ExportService
 */

import { logger } from '../../shared/logger/index.js';

/**
 * Contact data for export
 */
export interface ExportContact {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  location?: string | null;
  notes?: string | null;
  sectors?: string[];
  skills?: string[];
  createdAt: Date;
}

/**
 * Export Service
 *
 * Provides methods for exporting contacts to different formats.
 */
export class ExportService {
  /**
   * Export contacts to CSV format
   *
   * @param contacts - Array of contacts to export
   * @returns CSV string
   */
  exportToCSV(contacts: ExportContact[]): string {
    const headers = [
      'Full Name',
      'Email',
      'Phone',
      'Company',
      'Job Title',
      'Website',
      'LinkedIn',
      'Location',
      'Sectors',
      'Skills',
      'Notes',
      'Created At',
    ];

    const escapeCSV = (value: string | null | undefined): string => {
      if (!value) return '';
      const escaped = value.replace(/"/g, '""');
      return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')
        ? `"${escaped}"`
        : escaped;
    };

    const rows = contacts.map((contact) => [
      escapeCSV(contact.fullName),
      escapeCSV(contact.email),
      escapeCSV(contact.phone),
      escapeCSV(contact.company),
      escapeCSV(contact.jobTitle),
      escapeCSV(contact.website),
      escapeCSV(contact.linkedinUrl),
      escapeCSV(contact.location),
      escapeCSV(contact.sectors?.join('; ')),
      escapeCSV(contact.skills?.join('; ')),
      escapeCSV(contact.notes),
      escapeCSV(contact.createdAt.toISOString()),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    logger.info(`Exported ${contacts.length} contacts to CSV`);
    return csvContent;
  }

  /**
   * Export a single contact to vCard format (VCF)
   *
   * @param contact - Contact to export
   * @returns vCard string
   */
  exportToVCard(contact: ExportContact): string {
    const escapeVCard = (value: string | null | undefined): string => {
      if (!value) return '';
      return value
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
    };

    const nameParts = contact.fullName.split(' ');
    const lastName = nameParts.length > 1 ? nameParts.pop() : '';
    const firstName = nameParts.join(' ');

    const lines: string[] = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${escapeVCard(contact.fullName)}`,
      `N:${escapeVCard(lastName)};${escapeVCard(firstName)};;;`,
    ];

    if (contact.email) {
      lines.push(`EMAIL;TYPE=WORK:${escapeVCard(contact.email)}`);
    }

    if (contact.phone) {
      lines.push(`TEL;TYPE=WORK,VOICE:${escapeVCard(contact.phone)}`);
    }

    if (contact.company || contact.jobTitle) {
      lines.push(`ORG:${escapeVCard(contact.company)}`);
      if (contact.jobTitle) {
        lines.push(`TITLE:${escapeVCard(contact.jobTitle)}`);
      }
    }

    if (contact.website) {
      lines.push(`URL:${escapeVCard(contact.website)}`);
    }

    if (contact.linkedinUrl) {
      lines.push(`X-SOCIALPROFILE;TYPE=linkedin:${escapeVCard(contact.linkedinUrl)}`);
    }

    if (contact.location) {
      lines.push(`ADR;TYPE=WORK:;;${escapeVCard(contact.location)};;;;`);
    }

    if (contact.notes) {
      lines.push(`NOTE:${escapeVCard(contact.notes)}`);
    }

    if (contact.sectors && contact.sectors.length > 0) {
      lines.push(`CATEGORIES:${contact.sectors.map(escapeVCard).join(',')}`);
    }

    lines.push(`REV:${contact.createdAt.toISOString()}`);
    lines.push('END:VCARD');

    return lines.join('\r\n');
  }

  /**
   * Export multiple contacts to vCard format
   *
   * @param contacts - Array of contacts to export
   * @returns vCard string with multiple contacts
   */
  exportToVCards(contacts: ExportContact[]): string {
    const vcards = contacts.map((contact) => this.exportToVCard(contact));
    logger.info(`Exported ${contacts.length} contacts to vCard`);
    return vcards.join('\r\n');
  }

  /**
   * Generate filename for export
   *
   * @param format - Export format
   * @param count - Number of contacts
   * @returns Suggested filename
   */
  generateFilename(format: 'csv' | 'vcard', count: number): string {
    const date = new Date().toISOString().split('T')[0];
    const extension = format === 'csv' ? 'csv' : 'vcf';
    return `contacts_${date}_${count}.${extension}`;
  }

  /**
   * Get MIME type for export format
   *
   * @param format - Export format
   * @returns MIME type
   */
  getMimeType(format: 'csv' | 'vcard'): string {
    return format === 'csv' ? 'text/csv' : 'text/vcard';
  }
}

// Export singleton instance
export const exportService = new ExportService();
export default exportService;
