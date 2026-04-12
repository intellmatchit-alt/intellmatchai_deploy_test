/**
 * Contact CRUD E2E Tests
 *
 * Tests the complete contact management flow.
 */

import { Request, Response, NextFunction } from 'express';

// Mock all dependencies
jest.mock('../../infrastructure/database/prisma/client.js', () => ({
  prisma: {
    contact: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    interaction: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../infrastructure/services/ExportService.js', () => ({
  exportService: {
    exportToCSV: jest.fn(),
    exportToVCard: jest.fn(),
    exportToVCards: jest.fn(),
    getMimeType: jest.fn().mockReturnValue('text/csv'),
    generateFilename: jest.fn().mockReturnValue('contacts.csv'),
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
import {
  createContactUseCase,
  getContactsUseCase,
  getContactUseCase,
  updateContactUseCase,
  deleteContactUseCase,
  addInteractionUseCase,
} from '../../application/use-cases/contact/index.js';

describe('Contact CRUD E2E Tests', () => {
  let controller: ContactController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  const mockContact = {
    id: 'contact-123',
    fullName: 'John Smith',
    email: 'john@example.com',
    phone: '+1234567890',
    company: 'Tech Corp',
    jobTitle: 'Engineer',
    location: 'New York',
    source: 'MANUAL',
    ownerId: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    contactSectors: [{ sector: { id: 's1', name: 'Technology' } }],
    contactSkills: [{ skill: { id: 'sk1', name: 'JavaScript' } }],
    interactions: [],
    matchResult: { finalScore: 85 },
  };

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

  describe('Complete Contact Lifecycle', () => {
    it('should complete full contact CRUD lifecycle', async () => {
      // Step 1: Create a new contact
      mockReq.body = {
        fullName: 'John Smith',
        email: 'john@example.com',
        phone: '+1234567890',
        company: 'Tech Corp',
        jobTitle: 'Engineer',
        sectors: ['s1'],
        skills: ['sk1'],
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

      // Step 2: List contacts
      jest.clearAllMocks();
      mockReq.query = { page: '1', pageSize: '20' };

      (getContactsUseCase.execute as jest.Mock).mockResolvedValue({
        contacts: [mockContact],
        total: 1,
        page: 1,
        pageSize: 20,
      });

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
          data: expect.objectContaining({
            contacts: expect.arrayContaining([
              expect.objectContaining({ fullName: 'John Smith' }),
            ]),
            total: 1,
          }),
        })
      );

      // Step 3: Get single contact
      jest.clearAllMocks();
      mockReq.params = { id: 'contact-123' };

      (getContactUseCase.execute as jest.Mock).mockResolvedValue(mockContact);

      await controller.getOne(mockReq as Request, mockRes as Response, mockNext);

      expect(getContactUseCase.execute).toHaveBeenCalledWith('user-123', 'contact-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'contact-123',
            fullName: 'John Smith',
          }),
        })
      );

      // Step 4: Update contact
      jest.clearAllMocks();
      mockReq.params = { id: 'contact-123' };
      mockReq.body = {
        fullName: 'John Smith Updated',
        jobTitle: 'Senior Engineer',
      };

      const updatedContact = {
        ...mockContact,
        fullName: 'John Smith Updated',
        jobTitle: 'Senior Engineer',
      };
      (updateContactUseCase.execute as jest.Mock).mockResolvedValue(updatedContact);

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(updateContactUseCase.execute).toHaveBeenCalledWith(
        'user-123',
        'contact-123',
        expect.objectContaining({
          fullName: 'John Smith Updated',
          jobTitle: 'Senior Engineer',
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);

      // Step 5: Add interaction
      jest.clearAllMocks();
      mockReq.params = { id: 'contact-123' };
      mockReq.body = {
        type: 'MEETING',
        notes: 'Had a coffee meeting',
        occurredAt: new Date().toISOString(),
      };

      (addInteractionUseCase.execute as jest.Mock).mockResolvedValue({
        id: 'interaction-1',
        contactId: 'contact-123',
        interactionType: 'MEETING',
        notes: 'Had a coffee meeting',
      });

      await controller.addInteraction(mockReq as Request, mockRes as Response, mockNext);

      expect(addInteractionUseCase.execute).toHaveBeenCalledWith(
        'user-123',
        'contact-123',
        'MEETING',
        expect.objectContaining({
          notes: 'Had a coffee meeting',
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);

      // Step 6: Delete contact
      jest.clearAllMocks();
      mockReq.params = { id: 'contact-123' };

      (deleteContactUseCase.execute as jest.Mock).mockResolvedValue(true);

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(deleteContactUseCase.execute).toHaveBeenCalledWith('user-123', 'contact-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Search and Filter', () => {
    it('should search contacts by name', async () => {
      mockReq.query = { search: 'John', page: '1', pageSize: '20' };

      (getContactsUseCase.execute as jest.Mock).mockResolvedValue({
        contacts: [mockContact],
        total: 1,
        page: 1,
        pageSize: 20,
      });

      await controller.getAll(mockReq as Request, mockRes as Response, mockNext);

      expect(getContactsUseCase.execute).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          search: 'John',
        })
      );
    });

    it('should filter contacts by sector', async () => {
      mockReq.query = { sector: 'technology', page: '1' };

      (getContactsUseCase.execute as jest.Mock).mockResolvedValue({
        contacts: [mockContact],
        total: 1,
        page: 1,
        pageSize: 20,
      });

      await controller.getAll(mockReq as Request, mockRes as Response, mockNext);

      expect(getContactsUseCase.execute).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          sector: 'technology',
        })
      );
    });

    it('should filter contacts by minimum match score', async () => {
      mockReq.query = { minScore: '70', page: '1' };

      (getContactsUseCase.execute as jest.Mock).mockResolvedValue({
        contacts: [mockContact],
        total: 1,
        page: 1,
        pageSize: 20,
      });

      await controller.getAll(mockReq as Request, mockRes as Response, mockNext);

      expect(getContactsUseCase.execute).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          minScore: 70,
        })
      );
    });

    it('should sort contacts', async () => {
      mockReq.query = { sortBy: 'fullName', sortOrder: 'asc', page: '1' };

      (getContactsUseCase.execute as jest.Mock).mockResolvedValue({
        contacts: [mockContact],
        total: 1,
        page: 1,
        pageSize: 20,
      });

      await controller.getAll(mockReq as Request, mockRes as Response, mockNext);

      expect(getContactsUseCase.execute).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          sortBy: 'fullName',
          sortOrder: 'asc',
        })
      );
    });
  });

  describe('Bulk Operations', () => {
    it('should import multiple contacts', async () => {
      mockReq.body = {
        format: 'csv',
        data: `Full Name,Email,Company
John Smith,john@example.com,Tech Corp
Jane Doe,jane@example.com,Finance Inc
Bob Wilson,bob@example.com,Health Co`,
      };

      (createContactUseCase.execute as jest.Mock)
        .mockResolvedValueOnce({ id: 'c1', fullName: 'John Smith' })
        .mockResolvedValueOnce({ id: 'c2', fullName: 'Jane Doe' })
        .mockResolvedValueOnce({ id: 'c3', fullName: 'Bob Wilson' });

      await controller.import(mockReq as Request, mockRes as Response, mockNext);

      expect(createContactUseCase.execute).toHaveBeenCalledTimes(3);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            imported: 3,
            total: 3,
          }),
        })
      );
    });
  });

  describe('Error Cases', () => {
    it('should handle contact not found', async () => {
      mockReq.params = { id: 'non-existent' };

      (getContactUseCase.execute as jest.Mock).mockResolvedValue(null);

      await controller.getOne(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle unauthenticated requests', async () => {
      mockReq.user = undefined;

      await controller.getAll(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle creation errors', async () => {
      mockReq.body = {
        fullName: 'John Smith',
        email: 'john@example.com',
      };

      (createContactUseCase.execute as jest.Mock).mockRejectedValue(
        new Error('Email already exists')
      );

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle update errors', async () => {
      mockReq.params = { id: 'contact-123' };
      mockReq.body = { fullName: 'Updated Name' };

      (updateContactUseCase.execute as jest.Mock).mockRejectedValue(
        new Error('Contact not found')
      );

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle delete errors', async () => {
      mockReq.params = { id: 'contact-123' };

      (deleteContactUseCase.execute as jest.Mock).mockRejectedValue(
        new Error('Cannot delete contact')
      );

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Interaction Types', () => {
    const interactionTypes = ['MEETING', 'EMAIL', 'CALL', 'MESSAGE', 'OTHER'];

    interactionTypes.forEach((type) => {
      it(`should add ${type} interaction`, async () => {
        mockReq.params = { id: 'contact-123' };
        mockReq.body = {
          type,
          notes: `Test ${type} interaction`,
        };

        (addInteractionUseCase.execute as jest.Mock).mockResolvedValue({
          id: 'interaction-1',
          contactId: 'contact-123',
          interactionType: type,
        });

        await controller.addInteraction(mockReq as Request, mockRes as Response, mockNext);

        expect(addInteractionUseCase.execute).toHaveBeenCalledWith(
          'user-123',
          'contact-123',
          type,
          expect.any(Object)
        );
        expect(mockRes.status).toHaveBeenCalledWith(201);
      });
    });
  });
});
