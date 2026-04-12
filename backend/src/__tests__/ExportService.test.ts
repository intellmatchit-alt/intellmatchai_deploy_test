/**
 * ExportService Unit Tests
 */

import { ExportService, ExportContact } from '../infrastructure/services/ExportService';

// Mock logger
jest.mock('../shared/logger/index.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    service = new ExportService();
  });

  const mockContact: ExportContact = {
    id: 'contact-1',
    fullName: 'John Smith',
    email: 'john@example.com',
    phone: '+1234567890',
    company: 'Tech Corp',
    jobTitle: 'Software Engineer',
    website: 'https://johnsmith.com',
    linkedinUrl: 'https://linkedin.com/in/johnsmith',
    location: 'San Francisco, CA',
    notes: 'Met at conference',
    sectors: ['Technology', 'Startups'],
    skills: ['JavaScript', 'React'],
    createdAt: new Date('2024-01-01'),
  };

  describe('exportToCSV', () => {
    it('should export contacts to CSV format', () => {
      const contacts = [mockContact];
      const csv = service.exportToCSV(contacts);

      expect(csv).toContain('Full Name');
      expect(csv).toContain('Email');
      expect(csv).toContain('John Smith');
      expect(csv).toContain('john@example.com');
      expect(csv).toContain('Tech Corp');
      expect(csv).toContain('Software Engineer');
    });

    it('should handle empty contacts array', () => {
      const csv = service.exportToCSV([]);

      expect(csv).toContain('Full Name');
      expect(csv.split('\n').length).toBe(1); // Only headers
    });

    it('should escape CSV special characters', () => {
      const contactWithComma: ExportContact = {
        ...mockContact,
        fullName: 'Smith, John',
        notes: 'Has "quotes" and, commas',
      };

      const csv = service.exportToCSV([contactWithComma]);

      expect(csv).toContain('"Smith, John"');
      expect(csv).toContain('"Has ""quotes"" and, commas"');
    });

    it('should handle null/undefined values', () => {
      const partialContact: ExportContact = {
        id: 'contact-2',
        fullName: 'Jane Doe',
        createdAt: new Date(),
      };

      const csv = service.exportToCSV([partialContact]);

      expect(csv).toContain('Jane Doe');
      expect(csv.split(',').some((cell) => cell === '')).toBe(true);
    });

    it('should join sectors with semicolon', () => {
      const csv = service.exportToCSV([mockContact]);

      expect(csv).toContain('Technology; Startups');
    });

    it('should join skills with semicolon', () => {
      const csv = service.exportToCSV([mockContact]);

      expect(csv).toContain('JavaScript; React');
    });
  });

  describe('exportToVCard', () => {
    it('should export contact to vCard format', () => {
      const vcard = service.exportToVCard(mockContact);

      expect(vcard).toContain('BEGIN:VCARD');
      expect(vcard).toContain('VERSION:3.0');
      expect(vcard).toContain('FN:John Smith');
      expect(vcard).toContain('N:Smith;John;;;');
      expect(vcard).toContain('EMAIL;TYPE=WORK:john@example.com');
      expect(vcard).toContain('TEL;TYPE=WORK,VOICE:+1234567890');
      expect(vcard).toContain('ORG:Tech Corp');
      expect(vcard).toContain('TITLE:Software Engineer');
      expect(vcard).toContain('URL:https://johnsmith.com');
      expect(vcard).toContain('X-SOCIALPROFILE;TYPE=linkedin:https://linkedin.com/in/johnsmith');
      expect(vcard).toContain('END:VCARD');
    });

    it('should handle single name correctly', () => {
      const singleNameContact: ExportContact = {
        id: 'contact-3',
        fullName: 'Madonna',
        createdAt: new Date(),
      };

      const vcard = service.exportToVCard(singleNameContact);

      expect(vcard).toContain('FN:Madonna');
      expect(vcard).toContain('N:;Madonna;;;');
    });

    it('should handle multi-part names', () => {
      const multiNameContact: ExportContact = {
        id: 'contact-4',
        fullName: 'John Paul Smith Jr',
        createdAt: new Date(),
      };

      const vcard = service.exportToVCard(multiNameContact);

      expect(vcard).toContain('FN:John Paul Smith Jr');
      expect(vcard).toContain('N:Jr;John Paul Smith;;;');
    });

    it('should escape vCard special characters', () => {
      const contactWithSpecialChars: ExportContact = {
        id: 'contact-5',
        fullName: 'John; Smith',
        notes: 'Line1\nLine2',
        createdAt: new Date(),
      };

      const vcard = service.exportToVCard(contactWithSpecialChars);

      expect(vcard).toContain('FN:John\\; Smith');
      expect(vcard).toContain('NOTE:Line1\\nLine2');
    });

    it('should include location as address', () => {
      const vcard = service.exportToVCard(mockContact);

      expect(vcard).toContain('ADR;TYPE=WORK:;;San Francisco\\, CA;;;;');
    });

    it('should include sectors as categories', () => {
      const vcard = service.exportToVCard(mockContact);

      expect(vcard).toContain('CATEGORIES:Technology,Startups');
    });

    it('should skip optional fields when not provided', () => {
      const minimalContact: ExportContact = {
        id: 'contact-6',
        fullName: 'Minimal User',
        createdAt: new Date(),
      };

      const vcard = service.exportToVCard(minimalContact);

      expect(vcard).not.toContain('EMAIL');
      expect(vcard).not.toContain('TEL');
      expect(vcard).not.toContain('ORG');
      expect(vcard).not.toContain('TITLE');
      expect(vcard).not.toContain('URL');
      expect(vcard).not.toContain('NOTE');
      expect(vcard).not.toContain('ADR');
    });
  });

  describe('exportToVCards', () => {
    it('should export multiple contacts to vCard format', () => {
      const contacts = [
        mockContact,
        { ...mockContact, id: 'contact-2', fullName: 'Jane Doe', email: 'jane@example.com' },
      ];

      const vcards = service.exportToVCards(contacts);

      expect(vcards).toContain('FN:John Smith');
      expect(vcards).toContain('FN:Jane Doe');
      expect((vcards.match(/BEGIN:VCARD/g) || []).length).toBe(2);
      expect((vcards.match(/END:VCARD/g) || []).length).toBe(2);
    });

    it('should handle empty array', () => {
      const vcards = service.exportToVCards([]);

      expect(vcards).toBe('');
    });
  });

  describe('generateFilename', () => {
    it('should generate CSV filename', () => {
      const filename = service.generateFilename('csv', 10);

      expect(filename).toMatch(/^contacts_\d{4}-\d{2}-\d{2}_10\.csv$/);
    });

    it('should generate vCard filename', () => {
      const filename = service.generateFilename('vcard', 5);

      expect(filename).toMatch(/^contacts_\d{4}-\d{2}-\d{2}_5\.vcf$/);
    });
  });

  describe('getMimeType', () => {
    it('should return CSV MIME type', () => {
      expect(service.getMimeType('csv')).toBe('text/csv');
    });

    it('should return vCard MIME type', () => {
      expect(service.getMimeType('vcard')).toBe('text/vcard');
    });
  });
});
