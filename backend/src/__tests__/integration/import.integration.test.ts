/**
 * Import Endpoints Integration Tests
 *
 * Tests the import API endpoints with mocked services.
 */

import { Request, Response, NextFunction } from 'express';

// Create mock function for execute
const mockExecute = jest.fn();

// Mock all dependencies before imports
jest.mock('../../infrastructure/database/prisma/client.js', () => ({
  prisma: {
    contact: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    matchResult: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn({ contact: { create: jest.fn() } })),
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

jest.mock('../../infrastructure/repositories/PrismaContactRepository.js', () => ({
  PrismaContactRepository: jest.fn().mockImplementation(() => ({
    create: mockExecute,
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findByEmail: jest.fn(),
  })),
}));

jest.mock('../../infrastructure/external/matching/DeterministicMatchingService.js', () => ({
  DeterministicMatchingService: jest.fn().mockImplementation(() => ({
    calculateMatch: jest.fn(),
  })),
}));

jest.mock('../../infrastructure/external/enrichment/index.js', () => ({
  getEnrichmentOrchestrator: jest.fn().mockReturnValue(null),
}));

// Mock the use case classes
jest.mock('../../application/use-cases/contact/index.js', () => {
  const mockExecuteFn = jest.fn();
  return {
    CreateContactUseCase: jest.fn().mockImplementation(() => ({
      execute: mockExecuteFn,
    })),
    GetContactsUseCase: jest.fn().mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ contacts: [], total: 0 }),
    })),
    GetContactUseCase: jest.fn().mockImplementation(() => ({
      execute: jest.fn(),
    })),
    UpdateContactUseCase: jest.fn().mockImplementation(() => ({
      execute: jest.fn(),
    })),
    DeleteContactUseCase: jest.fn().mockImplementation(() => ({
      execute: jest.fn(),
    })),
    AddInteractionUseCase: jest.fn().mockImplementation(() => ({
      execute: jest.fn(),
    })),
    GetRecentContactsUseCase: jest.fn().mockImplementation(() => ({
      execute: jest.fn(),
    })),
    GetFollowUpContactsUseCase: jest.fn().mockImplementation(() => ({
      execute: jest.fn(),
    })),
    __mockExecute: mockExecuteFn,
  };
});

import { ContactController } from '../../presentation/controllers/ContactController';
import * as contactUseCases from '../../application/use-cases/contact/index.js';

// Get reference to the mock execute function
const createContactExecute = (contactUseCases as any).__mockExecute;

describe('Import Integration Tests', () => {
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
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('POST /contacts/import', () => {
    describe('CSV Import', () => {
      it('should import contacts from CSV with standard headers', async () => {
        mockReq.body = {
          format: 'csv',
          data: `Full Name,Email,Phone,Company,Job Title
John Smith,john@example.com,+1234567890,Tech Corp,Engineer
Jane Doe,jane@example.com,+0987654321,Finance Inc,Analyst`,
        };

        createContactExecute
          .mockResolvedValueOnce({ id: 'new-1', fullName: 'John Smith' })
          .mockResolvedValueOnce({ id: 'new-2', fullName: 'Jane Doe' });

        await controller.import(mockReq as Request, mockRes as Response, mockNext);

        expect(createContactExecute).toHaveBeenCalledTimes(2);
        expect(createContactExecute).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            fullName: 'John Smith',
            email: 'john@example.com',
            phone: '+1234567890',
            company: 'Tech Corp',
            jobTitle: 'Engineer',
          })
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              imported: 2,
              failed: 0,
              total: 2,
            }),
          })
        );
      });

      it('should handle CSV with alternative header names', async () => {
        mockReq.body = {
          format: 'csv',
          data: `name,email_address,telephone,organization,title
Bob Wilson,bob@example.com,555-1234,Acme Co,Manager`,
        };

        createContactExecute.mockResolvedValue({
          id: 'new-1',
          fullName: 'Bob Wilson',
        });

        await controller.import(mockReq as Request, mockRes as Response, mockNext);

        expect(createContactExecute).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            fullName: 'Bob Wilson',
            email: 'bob@example.com',
          })
        );
      });

      it('should handle quoted values with commas', async () => {
        mockReq.body = {
          format: 'csv',
          data: `Full Name,Company,Email
"Smith, John","Tech Corp, Inc.",john@example.com`,
        };

        createContactExecute.mockResolvedValue({
          id: 'new-1',
          fullName: 'Smith, John',
        });

        await controller.import(mockReq as Request, mockRes as Response, mockNext);

        expect(createContactExecute).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            fullName: 'Smith, John',
            company: 'Tech Corp, Inc.',
          })
        );
      });

      it('should skip rows without full name', async () => {
        mockReq.body = {
          format: 'csv',
          data: `Full Name,Email
John Smith,john@example.com
,jane@example.com
Bob Wilson,bob@example.com`,
        };

        createContactExecute.mockResolvedValue({ id: 'new' });

        await controller.import(mockReq as Request, mockRes as Response, mockNext);

        expect(createContactExecute).toHaveBeenCalledTimes(2);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              imported: 2,
              failed: 1,
            }),
          })
        );
      });

      it('should handle import failures gracefully', async () => {
        mockReq.body = {
          format: 'csv',
          data: `Full Name,Email
John Smith,john@example.com
Jane Doe,jane@example.com`,
        };

        createContactExecute
          .mockResolvedValueOnce({ id: 'new-1' })
          .mockRejectedValueOnce(new Error('Duplicate email'));

        await controller.import(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              imported: 1,
              failed: 1,
              errors: expect.arrayContaining([
                expect.objectContaining({
                  row: 2,
                  error: 'Duplicate email',
                }),
              ]),
            }),
          })
        );
      });
    });

    describe('vCard Import', () => {
      it('should import contact from vCard', async () => {
        mockReq.body = {
          format: 'vcard',
          data: `BEGIN:VCARD
VERSION:3.0
FN:John Smith
N:Smith;John;;;
EMAIL:john@example.com
TEL:+1234567890
ORG:Tech Corp
TITLE:Engineer
END:VCARD`,
        };

        createContactExecute.mockResolvedValue({
          id: 'new-1',
          fullName: 'John Smith',
        });

        await controller.import(mockReq as Request, mockRes as Response, mockNext);

        expect(createContactExecute).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            fullName: 'John Smith',
            email: 'john@example.com',
            phone: '+1234567890',
            company: 'Tech Corp',
            jobTitle: 'Engineer',
          })
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('should import multiple vCards', async () => {
        mockReq.body = {
          format: 'vcard',
          data: `BEGIN:VCARD
VERSION:3.0
FN:John Smith
EMAIL:john@example.com
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Jane Doe
EMAIL:jane@example.com
END:VCARD`,
        };

        createContactExecute
          .mockResolvedValueOnce({ id: 'new-1' })
          .mockResolvedValueOnce({ id: 'new-2' });

        await controller.import(mockReq as Request, mockRes as Response, mockNext);

        expect(createContactExecute).toHaveBeenCalledTimes(2);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              imported: 2,
              total: 2,
            }),
          })
        );
      });

      it('should handle vCard with URL field', async () => {
        mockReq.body = {
          format: 'vcard',
          data: `BEGIN:VCARD
VERSION:3.0
FN:John Smith
URL:https://linkedin.com/in/johnsmith
END:VCARD`,
        };

        createContactExecute.mockResolvedValue({ id: 'new-1' });

        await controller.import(mockReq as Request, mockRes as Response, mockNext);

        expect(createContactExecute).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            fullName: 'John Smith',
            linkedinUrl: 'https://linkedin.com/in/johnsmith',
          })
        );
      });

      it('should handle vCard with ADR field', async () => {
        mockReq.body = {
          format: 'vcard',
          data: `BEGIN:VCARD
VERSION:3.0
FN:John Smith
ADR:;;123 Main St;New York;NY;10001;USA
END:VCARD`,
        };

        createContactExecute.mockResolvedValue({ id: 'new-1' });

        await controller.import(mockReq as Request, mockRes as Response, mockNext);

        expect(createContactExecute).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            fullName: 'John Smith',
            location: expect.stringContaining('New York'),
          })
        );
      });
    });

    describe('Error Handling', () => {
      it('should return 400 when no data provided', async () => {
        mockReq.body = {};

        await controller.import(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              code: 'INVALID_DATA',
            }),
          })
        );
      });

      it('should return 400 for invalid format', async () => {
        mockReq.body = {
          format: 'xml',
          data: '<contacts></contacts>',
        };

        await controller.import(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      it('should require authentication', async () => {
        mockReq.user = undefined;
        mockReq.body = {
          format: 'csv',
          data: 'Full Name\nJohn Smith',
        };

        await controller.import(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });

      it('should handle empty CSV', async () => {
        mockReq.body = {
          format: 'csv',
          data: 'Full Name,Email',
        };

        await controller.import(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              imported: 0,
              total: 0,
            }),
          })
        );
      });
    });
  });
});
