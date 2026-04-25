/**
 * Use Case: Export Pitch Results
 * Exports pitch results in JSON or CSV format.
 */

import {
  IPitchRepository,
  IPitchSectionRepository,
  IPitchNeedRepository,
  IPitchMatchRepository,
} from '../../../domain/repositories/IPitchRepository';
import { IContactRepository } from '../../../domain/repositories/IContactRepository';
import { PitchStatus } from '../../../domain/entities/Pitch';
import { NotFoundError, AuthorizationError, DomainException, ConflictError } from '../../../shared/errors/index';

export interface ExportResult {
  format: string;
  data: string;
  filename: string;
  contentType: string;
}

export class ExportPitchResultsUseCase {
  constructor(
    private readonly pitchRepository: IPitchRepository,
    private readonly sectionRepository: IPitchSectionRepository,
    private readonly needRepository: IPitchNeedRepository,
    private readonly matchRepository: IPitchMatchRepository,
    private readonly contactRepository: IContactRepository,
  ) {}

  async execute(userId: string, pitchId: string, format: 'json' | 'csv'): Promise<ExportResult> {
    // Verify pitch ownership
    const pitch = await this.pitchRepository.findById(pitchId);
    if (!pitch) {
      throw new NotFoundError('Pitch');
    }
    if (pitch.userId !== userId) {
      throw new AuthorizationError('Access denied');
    }
    if (pitch.deletedAt) {
      throw new DomainException('Pitch has been deleted');
    }
    if (pitch.status !== PitchStatus.COMPLETED) {
      throw new ConflictError(`Pitch is still processing. Current status: ${pitch.status}`);
    }

    // Fetch all data
    const sections = await this.sectionRepository.findByPitchId(pitchId);
    const needs = await this.needRepository.findByPitchId(pitchId);

    // Fetch all matches with contact details
    const matchesWithContacts: Array<{
      sectionTitle: string;
      sectionType: string;
      contactName: string;
      contactCompany: string | null;
      contactJobTitle: string | null;
      contactEmail: string | null;
      score: number;
      relevanceScore: number;
      expertiseScore: number;
      strategicScore: number;
      relationshipScore: number;
      angleCategory: string | null;
      outreachDraft: string | null;
      status: string;
    }> = [];

    for (const section of sections) {
      const matches = await this.matchRepository.findByPitchSectionId(section.id);
      for (const match of matches) {
        const contact = await this.contactRepository.findById(match.contactId);
        matchesWithContacts.push({
          sectionTitle: section.title,
          sectionType: section.type,
          contactName: contact?.name || 'Unknown',
          contactCompany: contact?.company || null,
          contactJobTitle: contact?.jobTitle || null,
          contactEmail: contact?.email || null,
          score: match.score,
          relevanceScore: match.relevanceScore,
          expertiseScore: match.expertiseScore,
          strategicScore: match.strategicScore,
          relationshipScore: match.relationshipScore,
          angleCategory: match.angleCategory,
          outreachDraft: match.outreachDraft,
          status: match.status,
        });
      }
    }

    const safeName = (pitch.title || pitch.fileName || 'pitch').replace(/[^a-zA-Z0-9]/g, '_');

    if (format === 'csv') {
      return this.exportCSV(safeName, matchesWithContacts);
    }

    return this.exportJSON(safeName, pitch, sections, needs, matchesWithContacts);
  }

  private exportCSV(
    safeName: string,
    matches: Array<Record<string, any>>,
  ): ExportResult {
    if (matches.length === 0) {
      return {
        format: 'csv',
        data: 'No matches found',
        filename: `${safeName}_results.csv`,
        contentType: 'text/csv',
      };
    }

    const headers = [
      'Section Title',
      'Section Type',
      'Contact Name',
      'Company',
      'Job Title',
      'Email',
      'Score',
      'Relevance',
      'Expertise',
      'Strategic',
      'Relationship',
      'Angle',
      'Status',
      'Outreach Draft',
    ];

    const rows = matches.map((m) => [
      this.csvEscape(m.sectionTitle),
      this.csvEscape(m.sectionType),
      this.csvEscape(m.contactName),
      this.csvEscape(m.contactCompany || ''),
      this.csvEscape(m.contactJobTitle || ''),
      this.csvEscape(m.contactEmail || ''),
      m.score.toString(),
      m.relevanceScore.toFixed(2),
      m.expertiseScore.toFixed(2),
      m.strategicScore.toFixed(2),
      m.relationshipScore.toFixed(2),
      this.csvEscape(m.angleCategory || ''),
      this.csvEscape(m.status),
      this.csvEscape(m.outreachDraft || ''),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    return {
      format: 'csv',
      data: csv,
      filename: `${safeName}_results.csv`,
      contentType: 'text/csv',
    };
  }

  private exportJSON(
    safeName: string,
    pitch: any,
    sections: any[],
    needs: any[],
    matches: Array<Record<string, any>>,
  ): ExportResult {
    const exportData = {
      pitch: {
        id: pitch.id,
        title: pitch.title,
        companyName: pitch.companyName,
        fileName: pitch.fileName,
        language: pitch.language,
        uploadedAt: pitch.uploadedAt,
        processedAt: pitch.processedAt,
      },
      sections: sections.map((s) => ({
        type: s.type,
        title: s.title,
        confidence: s.confidence,
      })),
      needs: needs.map((n) => ({
        key: n.key,
        label: n.label,
        description: n.description,
        confidence: n.confidence,
      })),
      matches,
      summary: {
        totalMatches: matches.length,
        avgScore: matches.length > 0
          ? Math.round(matches.reduce((sum, m) => sum + m.score, 0) / matches.length)
          : 0,
      },
      exportedAt: new Date().toISOString(),
    };

    return {
      format: 'json',
      data: JSON.stringify(exportData, null, 2),
      filename: `${safeName}_results.json`,
      contentType: 'application/json',
    };
  }

  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
