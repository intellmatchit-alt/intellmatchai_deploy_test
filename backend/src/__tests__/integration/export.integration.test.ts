/**
 * Export Endpoints Integration Tests
 *
 * Tests the export API endpoints with mocked services.
 */

import { Request, Response, NextFunction } from 'express';

// Mock dependencies before imports
jest.mock('../../infrastructure/database/prisma/client.js', () => ({
  prisma: {
    contact: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../infrastructure/services/ExportService.js', () => ({
  exportService: {
    exportToCSV: jest.fn(),
    exportToVCard: jest.fn(),
    exportToVCards: jest.fn(),
    getMimeType: jest.fn(),
    generateFilename: jest.fn(),
  },
}));

jest.mock('../../shared/logger/index.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../application/use-cases/contact/index.js', () => ({
  createContactUseCase: { execute: jest.fn() },
  getContactsUseCase: { execute: jest.fn() },
  getContactUseCase: { execute: jest.fn() },
  updateContactUseCase: { execute: jest.fn() },
  deleteContactUseCase: { execute: jest.fn() },
  addInteractionUseCase: { execute: jest.fn() },
}));

import { ContactController } from '../../presentation/controllers/ContactController';
import { prisma } from '../../infrastructure/database/prisma/client.js';
import { exportService } from '../../infrastructure/services/ExportService.js';

describe('Export Integration Tests', () => {
  let controller: ContactController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  const mockContacts = [
    {
      id: 'contact-1',
      fullName: 'John Smith',
      email: 'john@example.com',
      phone: '+1234567890',
      company: 'Tech Corp',
      jobTitle: 'Engineer',
      location: 'New York',
      ownerId: 'user-123',
      contactSectors: [{ sector: { name: 'Technology' } }],
      contactSkills: [{ skill: { name: 'JavaScript' } }],
    },
    {
      id: 'contact-2',
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+0987654321',
      company: 'Finance Inc',
      jobTitle: 'Analyst',
      location: 'London',
      ownerId: 'user-123',
      contactSectors: [{ sector: { name: 'Finance' } }],
      contactSkills: [{ skill: { name: 'Excel' } }],
    },
  ];

  beforeEach(() => {
    controller = new ContactController();
    mockReq = {
      user: { userId: 'user-123', email: 'test@example.com' },
      body: {},
      params: {},
      query: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('GET /contacts/export', () => {
    describe('CSV Export', () => {
      it('should export all contacts as CSV', async () => {
        mockReq.query = { format: 'csv' };

        (prisma.contact.findMany as jest.Mock).mockResolvedValue(mockContacts);
        (exportService.exportToCSV as jest.Mock).mockReturnValue(
          'Full Name,Email,Phone,Company\nJohn Smith,john@example.com,+1234567890,Tech Corp\nJane Doe,jane@example.com,+0987654321,Finance Inc'
        );
        (exportService.getMimeType as jest.Mock).mockReturnValue('text/csv');
        (exportService.generateFilename as jest.Mock).mockReturnValue('contacts-2024-01-01.csv');

        await controller.export(mockReq as Request, mockRes as Response, mockNext);

        expect(prisma.contact.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { ownerId: 'user-123' },
          })
        );
        expect(exportService.exportToCSV).toHaveBeenCalledWith(mockContacts);
        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Content-Disposition',
          expect.stringContaining('attachment')
        );
        expect(mockRes.send).toHaveBeenCalled();
      });

      it('should handle empty contacts list', async () => {
        mockReq.query = { format: 'csv' };

        (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);
        (exportService.exportToCSV as jest.Mock).mockReturnValue('Full Name,Email,Phone,Company');
        (exportService.getMimeType as jest.Mock).mockReturnValue('text/csv');
        (exportService.generateFilename as jest.Mock).mockReturnValue('contacts.csv');

        await controller.export(mockReq as Request, mockRes as Response, mockNext);

        expect(exportService.exportToCSV).toHaveBeenCalledWith([]);
        expect(mockRes.send).toHaveBeenCalled();
      });
    });

    describe('vCard Export', () => {
      it('should export all contacts as vCard', async () => {
        mockReq.query = { format: 'vcard' };

        (prisma.contact.findMany as jest.Mock).mockResolvedValue(mockContacts);
        (exportService.exportToVCards as jest.Mock).mockReturnValue(
          'BEGIN:VCARD\nVERSION:3.0\nFN:John Smith\nEND:VCARD\nBEGIN:VCARD\nVERSION:3.0\nFN:Jane Doe\nEND:VCARD'
        );
        (exportService.getMimeType as jest.Mock).mockReturnValue('text/vcard');
        (exportService.generateFilename as jest.Mock).mockReturnValue('contacts.vcf');

        await controller.export(mockReq as Request, mockRes as Response, mockNext);

        expect(exportService.exportToVCards).toHaveBeenCalledWith(mockContacts);
        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/vcard');
      });
    });

    it('should default to CSV when format not specified', async () => {
      mockReq.query = {};

      (prisma.contact.findMany as jest.Mock).mockResolvedValue(mockContacts);
      (exportService.exportToCSV as jest.Mock).mockReturnValue('csv content');
      (exportService.getMimeType as jest.Mock).mockReturnValue('text/csv');
      (exportService.generateFilename as jest.Mock).mockReturnValue('contacts.csv');

      await controller.export(mockReq as Request, mockRes as Response, mockNext);

      expect(exportService.exportToCSV).toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      mockReq.user = undefined;
      mockReq.query = { format: 'csv' };

      await controller.export(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('GET /contacts/:id/export', () => {
    it('should export single contact as vCard', async () => {
      mockReq.params = { id: 'contact-1' };

      (prisma.contact.findUnique as jest.Mock).mockResolvedValue(mockContacts[0]);
      (exportService.exportToVCard as jest.Mock).mockReturnValue(
        'BEGIN:VCARD\nVERSION:3.0\nFN:John Smith\nEMAIL:john@example.com\nEND:VCARD'
      );
      (exportService.getMimeType as jest.Mock).mockReturnValue('text/vcard');
      (exportService.generateFilename as jest.Mock).mockReturnValue('john-smith.vcf');

      await controller.exportOne(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.contact.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'contact-1' },
        })
      );
      expect(exportService.exportToVCard).toHaveBeenCalledWith(mockContacts[0]);
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should return 404 for non-existent contact', async () => {
      mockReq.params = { id: 'non-existent' };

      (prisma.contact.findUnique as jest.Mock).mockResolvedValue(null);

      await controller.exportOne(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 for contact owned by different user', async () => {
      mockReq.params = { id: 'contact-1' };

      (prisma.contact.findUnique as jest.Mock).mockResolvedValue({
        ...mockContacts[0],
        ownerId: 'different-user',
      });

      await controller.exportOne(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
