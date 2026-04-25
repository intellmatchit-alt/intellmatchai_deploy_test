/**
 * ContactController Unit Tests
 */

import { Request, Response, NextFunction } from 'express';

// Must define mocks inline in jest.mock call (Jest hoists these)
jest.mock('../application/use-cases/contact/index.js', () => ({
  createContactUseCase: { execute: jest.fn() },
  getContactsUseCase: { execute: jest.fn() },
  getContactUseCase: { execute: jest.fn() },
  updateContactUseCase: { execute: jest.fn() },
  deleteContactUseCase: { execute: jest.fn() },
  addInteractionUseCase: { execute: jest.fn() },
}));

// Mock export service
jest.mock('../infrastructure/services/ExportService.js', () => ({
  exportService: {
    exportToCSV: jest.fn().mockReturnValue('csv-content'),
    exportToVCard: jest.fn().mockReturnValue('vcard-content'),
    exportToVCards: jest.fn().mockReturnValue('vcards-content'),
    getMimeType: jest.fn().mockReturnValue('text/csv'),
    generateFilename: jest.fn().mockReturnValue('contacts.csv'),
  },
}));

// Mock prisma
jest.mock('../infrastructure/database/prisma/client.js', () => ({
  prisma: {
    contact: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../shared/logger/index.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Import after mocks are defined
import { ContactController } from '../presentation/controllers/ContactController';
import {
  createContactUseCase,
  getContactsUseCase,
  getContactUseCase,
  updateContactUseCase,
  deleteContactUseCase,
  addInteractionUseCase,
} from '../application/use-cases/contact/index';
import { prisma } from '../infrastructure/database/prisma/client';
import { exportService } from '../infrastructure/services/ExportService';

describe('ContactController', () => {
  let controller: ContactController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

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

  describe('create', () => {
    it('should create a contact successfully', async () => {
      const mockContact = {
        id: 'contact-123',
        fullName: 'John Smith',
        email: 'john@example.com',
        company: 'Tech Corp',
      };

      mockReq.body = {
        fullName: 'John Smith',
        email: 'john@example.com',
        company: 'Tech Corp',
      };

      (createContactUseCase.execute as jest.Mock).mockResolvedValue(mockContact);

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(createContactUseCase.execute).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          fullName: 'John Smith',
          email: 'john@example.com',
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should throw error when not authenticated', async () => {
      mockReq.user = undefined;

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getAll', () => {
    it('should return paginated contacts', async () => {
      const mockResult = {
        contacts: [
          { id: 'contact-1', fullName: 'John Smith' },
          { id: 'contact-2', fullName: 'Jane Doe' },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      };

      mockReq.query = { page: '1', pageSize: '20' };
      (getContactsUseCase.execute as jest.Mock).mockResolvedValue(mockResult);

      await controller.getAll(mockReq as Request, mockRes as Response, mockNext);

      expect(getContactsUseCase.execute).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          page: 1,
          pageSize: 20,
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockResult,
        })
      );
    });

    it('should handle filters', async () => {
      mockReq.query = {
        page: '1',
        sector: 'technology',
        search: 'john',
        minScore: '50',
      };

      (getContactsUseCase.execute as jest.Mock).mockResolvedValue({
        contacts: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });

      await controller.getAll(mockReq as Request, mockRes as Response, mockNext);

      expect(getContactsUseCase.execute).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          sector: 'technology',
          search: 'john',
          minScore: 50,
        })
      );
    });
  });

  describe('getOne', () => {
    it('should return a single contact', async () => {
      const mockContact = {
        id: 'contact-123',
        fullName: 'John Smith',
        email: 'john@example.com',
      };

      mockReq.params = { id: 'contact-123' };
      (getContactUseCase.execute as jest.Mock).mockResolvedValue(mockContact);

      await controller.getOne(mockReq as Request, mockRes as Response, mockNext);

      expect(getContactUseCase.execute).toHaveBeenCalledWith('user-123', 'contact-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when contact not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      (getContactUseCase.execute as jest.Mock).mockResolvedValue(null);

      await controller.getOne(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('update', () => {
    it('should update a contact successfully', async () => {
      const mockContact = {
        id: 'contact-123',
        fullName: 'John Smith Updated',
        email: 'john.updated@example.com',
      };

      mockReq.params = { id: 'contact-123' };
      mockReq.body = { fullName: 'John Smith Updated' };
      (updateContactUseCase.execute as jest.Mock).mockResolvedValue(mockContact);

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(updateContactUseCase.execute).toHaveBeenCalledWith(
        'user-123',
        'contact-123',
        expect.objectContaining({
          fullName: 'John Smith Updated',
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('delete', () => {
    it('should delete a contact successfully', async () => {
      mockReq.params = { id: 'contact-123' };
      (deleteContactUseCase.execute as jest.Mock).mockResolvedValue(true);

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(deleteContactUseCase.execute).toHaveBeenCalledWith('user-123', 'contact-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('addInteraction', () => {
    it('should add interaction to contact', async () => {
      mockReq.params = { id: 'contact-123' };
      mockReq.body = {
        type: 'MEETING',
        notes: 'Had coffee meeting',
      };

      (addInteractionUseCase.execute as jest.Mock).mockResolvedValue({
        id: 'interaction-1',
        contactId: 'contact-123',
        interactionType: 'MEETING',
      });

      await controller.addInteraction(mockReq as Request, mockRes as Response, mockNext);

      expect(addInteractionUseCase.execute).toHaveBeenCalledWith(
        'user-123',
        'contact-123',
        'MEETING',
        expect.objectContaining({ notes: 'Had coffee meeting' })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('export', () => {
    it('should export contacts as CSV', async () => {
      mockReq.query = { format: 'csv' };

      (prisma.contact.findMany as jest.Mock).mockResolvedValue([
        { id: 'contact-1', fullName: 'John Smith', email: 'john@example.com' },
      ]);

      await controller.export(mockReq as Request, mockRes as Response, mockNext);

      expect(exportService.exportToCSV).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockRes.send).toHaveBeenCalledWith('csv-content');
    });

    it('should export contacts as vCard', async () => {
      mockReq.query = { format: 'vcard' };

      (prisma.contact.findMany as jest.Mock).mockResolvedValue([
        { id: 'contact-1', fullName: 'John Smith', email: 'john@example.com' },
      ]);

      (exportService.getMimeType as jest.Mock).mockReturnValue('text/vcard');

      await controller.export(mockReq as Request, mockRes as Response, mockNext);

      expect(exportService.exportToVCards).toHaveBeenCalled();
    });
  });

  describe('exportOne', () => {
    it('should export single contact as vCard', async () => {
      mockReq.params = { id: 'contact-123' };

      (prisma.contact.findUnique as jest.Mock).mockResolvedValue({
        id: 'contact-123',
        fullName: 'John Smith',
        ownerId: 'user-123',
      });

      await controller.exportOne(mockReq as Request, mockRes as Response, mockNext);

      expect(exportService.exportToVCard).toHaveBeenCalled();
      expect(mockRes.send).toHaveBeenCalledWith('vcard-content');
    });

    it('should return 404 when contact not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      (prisma.contact.findUnique as jest.Mock).mockResolvedValue(null);

      await controller.exportOne(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('import', () => {
    it('should import contacts from CSV', async () => {
      mockReq.body = {
        format: 'csv',
        data: 'Full Name,Email,Company\nJohn Smith,john@example.com,Tech Corp',
      };

      (createContactUseCase.execute as jest.Mock).mockResolvedValue({
        id: 'contact-new',
        fullName: 'John Smith',
      });

      await controller.import(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            imported: expect.any(Number),
          }),
        })
      );
    });

    it('should return error when no data provided', async () => {
      mockReq.body = {};

      await controller.import(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
