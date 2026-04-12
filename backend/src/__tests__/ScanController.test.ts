/**
 * ScanController Unit Tests
 */

import { Request, Response, NextFunction } from 'express';

// Mock minio (must be before any imports that use it)
jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    putObject: jest.fn(),
    getObject: jest.fn(),
    removeObject: jest.fn(),
    bucketExists: jest.fn().mockResolvedValue(true),
    makeBucket: jest.fn(),
  })),
}));

// Mock config
jest.mock('../config/index.js', () => ({
  config: {
    storage: {
      provider: 'local',
      minio: {
        endpoint: 'localhost',
        port: 9000,
        accessKey: 'test',
        secretKey: 'test',
        bucket: 'test',
        useSSL: false,
      },
      local: {
        basePath: '/tmp/uploads',
        baseUrl: 'http://localhost:3001/uploads',
      },
    },
    jwt: {
      secret: 'test-secret-key-that-is-at-least-32-chars',
      expiresIn: '15m',
    },
    redis: {
      url: 'redis://localhost:6379',
    },
    database: {
      url: 'mysql://test:test@localhost:3306/test',
    },
  },
}));

// Mock storage service factory
jest.mock('../infrastructure/external/storage/StorageServiceFactory.js', () => ({
  StorageServiceFactory: {
    create: jest.fn().mockReturnValue({
      uploadFile: jest.fn().mockResolvedValue('http://localhost/uploads/test.jpg'),
      getFile: jest.fn(),
      deleteFile: jest.fn(),
      fileExists: jest.fn().mockResolvedValue(true),
    }),
  },
}));

// Mock use cases - must be inline
jest.mock('../application/use-cases/scan/index.js', () => ({
  scanCardUseCase: { execute: jest.fn() },
  createContactFromScanUseCase: { execute: jest.fn() },
}));

// Mock prisma
jest.mock('../infrastructure/database/prisma/client.js', () => ({
  prisma: {
    sector: {
      findFirst: jest.fn(),
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

// Import after mocks
import { ScanController } from '../presentation/controllers/ScanController';
import { scanCardUseCase, createContactFromScanUseCase } from '../application/use-cases/scan/index.js';
import { prisma } from '../infrastructure/database/prisma/client.js';

describe('ScanController', () => {
  let controller: ScanController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    controller = new ScanController();
    mockReq = {
      user: { userId: 'user-123', email: 'test@example.com' },
      body: {},
      file: undefined,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('scan', () => {
    it('should scan a business card from base64 image', async () => {
      const mockScanResult = {
        fields: {
          fullName: 'John Smith',
          email: 'john@example.com',
          phone: '+1234567890',
          company: 'Tech Corp',
          jobTitle: 'Software Engineer',
        },
        rawText: 'John Smith\nSoftware Engineer\nTech Corp\njohn@example.com',
        confidence: 0.95,
        processingTimeMs: 1500,
      };

      mockReq.body = {
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      };

      (scanCardUseCase.execute as jest.Mock).mockResolvedValue(mockScanResult);

      await controller.scan(mockReq as Request, mockRes as Response, mockNext);

      expect(scanCardUseCase.execute).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            fields: expect.objectContaining({
              fullName: 'John Smith',
            }),
          }),
        })
      );
    });

    it('should scan a business card from file upload', async () => {
      const mockScanResult = {
        fields: {
          fullName: 'Jane Doe',
          email: 'jane@example.com',
        },
        rawText: 'Jane Doe\njane@example.com',
        confidence: 0.9,
        processingTimeMs: 1200,
      };

      mockReq.file = {
        buffer: Buffer.from('fake-image-data'),
        mimetype: 'image/jpeg',
        originalname: 'card.jpg',
      } as any;

      (scanCardUseCase.execute as jest.Mock).mockResolvedValue(mockScanResult);

      await controller.scan(mockReq as Request, mockRes as Response, mockNext);

      expect(scanCardUseCase.execute).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 when no image provided', async () => {
      mockReq.body = {};
      mockReq.file = undefined;

      await controller.scan(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NO_IMAGE',
          }),
        })
      );
    });

    it('should throw error when not authenticated', async () => {
      mockReq.user = undefined;
      mockReq.body = { image: 'data:image/png;base64,xxx' };

      await controller.scan(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('createContact', () => {
    it('should create a contact from scan results', async () => {
      const mockContact = {
        id: 'contact-123',
        fullName: 'John Smith',
        email: 'john@example.com',
        company: 'Tech Corp',
        source: 'CARD_SCAN',
      };

      mockReq.body = {
        fields: {
          fullName: 'John Smith',
          email: 'john@example.com',
          company: 'Tech Corp',
        },
        rawOcrText: 'John Smith\nTech Corp',
        cardImageUrl: 'data:image/png;base64,xxx',
      };

      (createContactFromScanUseCase.execute as jest.Mock).mockResolvedValue(mockContact);

      await controller.createContact(mockReq as Request, mockRes as Response, mockNext);

      expect(createContactFromScanUseCase.execute).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          fullName: 'John Smith',
        }),
        'John Smith\nTech Corp',
        'data:image/png;base64,xxx'
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 when required fields missing', async () => {
      mockReq.body = {
        fields: {
          // Missing fullName
          email: 'john@example.com',
        },
      };

      await controller.createContact(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('suggestSectors', () => {
    it('should suggest sectors based on company and job title', async () => {
      mockReq.body = {
        company: 'Tech Startup',
        jobTitle: 'Software Engineer',
      };

      (prisma.sector.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 'sector-1', name: 'Technology' })
        .mockResolvedValueOnce(null);

      await controller.suggestSectors(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            suggestedSectors: expect.any(Array),
          }),
        })
      );
    });

    it('should return empty array when no matches', async () => {
      mockReq.body = {
        company: 'Unknown Company',
        jobTitle: 'Unknown Role',
      };

      await controller.suggestSectors(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should match finance keywords', async () => {
      mockReq.body = {
        company: 'Goldman Sachs',
        jobTitle: 'Investment Banker',
      };

      (prisma.sector.findFirst as jest.Mock).mockResolvedValue({ id: 'sector-2', name: 'Finance' });

      await controller.suggestSectors(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.sector.findFirst).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should match healthcare keywords', async () => {
      mockReq.body = {
        company: 'City Hospital',
        jobTitle: 'Doctor',
      };

      (prisma.sector.findFirst as jest.Mock).mockResolvedValue({ id: 'sector-3', name: 'Healthcare' });

      await controller.suggestSectors(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});
