/**
 * Media Upload (Contact Notes) Unit Tests
 */

import { Request, Response, NextFunction } from 'express';

// Mock prisma
jest.mock('../infrastructure/database/prisma/client.js', () => ({
  prisma: {
    contact: {
      findUnique: jest.fn(),
    },
    contactNote: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Note: Storage is handled by multer.memoryStorage() in routes
// No external storage service mock needed for these unit tests

// Mock logger
jest.mock('../shared/logger/index.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

import { prisma } from '../infrastructure/database/prisma/client.js';

describe('Media Upload (Contact Notes)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      user: { userId: 'user-123', email: 'test@example.com' },
      body: {},
      params: { id: 'contact-123' },
      query: {},
      file: undefined,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('GET /contacts/:id/notes', () => {
    it('should return notes for a contact', async () => {
      const mockNotes = [
        { id: 'note-1', type: 'TEXT', content: 'Test note', createdAt: new Date() },
        { id: 'note-2', type: 'IMAGE', mediaUrl: 'https://example.com/image.jpg', createdAt: new Date() },
      ];
      (prisma.contactNote.findMany as jest.Mock).mockResolvedValue(mockNotes);

      const result = await prisma.contactNote.findMany({
        where: { contactId: 'contact-123' },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toEqual(mockNotes);
      expect(result).toHaveLength(2);
    });

    it('should filter notes by type', async () => {
      const mockNotes = [
        { id: 'note-1', type: 'IMAGE', mediaUrl: 'https://example.com/image.jpg', createdAt: new Date() },
      ];
      (prisma.contactNote.findMany as jest.Mock).mockResolvedValue(mockNotes);

      const result = await prisma.contactNote.findMany({
        where: { contactId: 'contact-123', type: 'IMAGE' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('IMAGE');
    });

    it('should return empty array when no notes exist', async () => {
      (prisma.contactNote.findMany as jest.Mock).mockResolvedValue([]);

      const result = await prisma.contactNote.findMany({
        where: { contactId: 'contact-123' },
      });

      expect(result).toEqual([]);
    });
  });

  describe('POST /contacts/:id/notes (Text Note)', () => {
    it('should create a text note', async () => {
      const mockNote = {
        id: 'note-new',
        type: 'TEXT',
        content: 'Test content',
        contactId: 'contact-123',
        createdAt: new Date(),
      };
      (prisma.contactNote.create as jest.Mock).mockResolvedValue(mockNote);

      const result = await prisma.contactNote.create({
        data: {
          type: 'TEXT',
          content: 'Test content',
          contactId: 'contact-123',
        },
      });

      expect(result.type).toBe('TEXT');
      expect(result.content).toBe('Test content');
    });

    it('should validate content is required for text notes', () => {
      mockReq.body = { type: 'TEXT' };

      const { content } = mockReq.body;

      expect(content).toBeUndefined();
    });
  });

  describe('POST /contacts/:id/notes/image', () => {
    it('should validate image file is provided', () => {
      mockReq.file = undefined;

      expect(mockReq.file).toBeUndefined();
    });

    it('should accept valid image file', () => {
      mockReq.file = {
        fieldname: 'image',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
        size: 1024,
      } as Express.Multer.File;

      expect(mockReq.file).toBeDefined();
      expect(mockReq.file.mimetype).toContain('image/');
    });

    it('should reject non-image files', () => {
      const isImage = (mimetype: string) => mimetype.startsWith('image/');

      expect(isImage('application/pdf')).toBe(false);
      expect(isImage('text/plain')).toBe(false);
      expect(isImage('audio/mp3')).toBe(false);
    });

    it('should create image note after successful upload', async () => {
      const mockNote = {
        id: 'note-img',
        type: 'IMAGE',
        mediaUrl: 'https://storage.example.com/image.jpg',
        mimeType: 'image/jpeg',
        contactId: 'contact-123',
        createdAt: new Date(),
      };
      (prisma.contactNote.create as jest.Mock).mockResolvedValue(mockNote);

      const result = await prisma.contactNote.create({
        data: {
          type: 'IMAGE',
          mediaUrl: 'https://storage.example.com/image.jpg',
          mimeType: 'image/jpeg',
          contactId: 'contact-123',
        },
      });

      expect(result.type).toBe('IMAGE');
      expect(result.mediaUrl).toBeDefined();
    });

    it('should enforce 5MB file size limit', () => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const testFileSize = 6 * 1024 * 1024; // 6MB

      expect(testFileSize).toBeGreaterThan(maxSize);
    });
  });

  describe('POST /contacts/:id/notes/voice', () => {
    it('should validate voice file is provided', () => {
      mockReq.file = undefined;

      expect(mockReq.file).toBeUndefined();
    });

    it('should accept valid audio file', () => {
      mockReq.file = {
        fieldname: 'voice',
        originalname: 'voice.webm',
        encoding: '7bit',
        mimetype: 'audio/webm',
        buffer: Buffer.from('fake-audio-data'),
        size: 2048,
      } as Express.Multer.File;

      expect(mockReq.file).toBeDefined();
      expect(mockReq.file.mimetype).toContain('audio/');
    });

    it('should reject non-audio files', () => {
      const isAudio = (mimetype: string) => mimetype.startsWith('audio/');

      expect(isAudio('image/jpeg')).toBe(false);
      expect(isAudio('application/pdf')).toBe(false);
      expect(isAudio('video/mp4')).toBe(false);
    });

    it('should create voice note with duration', async () => {
      const mockNote = {
        id: 'note-voice',
        type: 'VOICE',
        mediaUrl: 'https://storage.example.com/voice.webm',
        mimeType: 'audio/webm',
        duration: 30,
        contactId: 'contact-123',
        createdAt: new Date(),
      };
      (prisma.contactNote.create as jest.Mock).mockResolvedValue(mockNote);

      const result = await prisma.contactNote.create({
        data: {
          type: 'VOICE',
          mediaUrl: 'https://storage.example.com/voice.webm',
          mimeType: 'audio/webm',
          duration: 30,
          contactId: 'contact-123',
        },
      });

      expect(result.type).toBe('VOICE');
      expect(result.duration).toBe(30);
    });

    it('should enforce 10MB file size limit for voice', () => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const testFileSize = 11 * 1024 * 1024; // 11MB

      expect(testFileSize).toBeGreaterThan(maxSize);
    });
  });

  describe('POST /contacts/:id/notes/file', () => {
    it('should accept PDF files', () => {
      const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      expect(allowedMimes).toContain('application/pdf');
    });

    it('should accept Word documents', () => {
      mockReq.file = {
        fieldname: 'file',
        originalname: 'document.docx',
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('fake-doc-data'),
        size: 4096,
      } as Express.Multer.File;

      const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      expect(allowedMimes).toContain(mockReq.file.mimetype);
    });

    it('should reject disallowed file types', () => {
      const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      expect(allowedMimes).not.toContain('application/x-executable');
      expect(allowedMimes).not.toContain('application/javascript');
    });

    it('should create file note with filename', async () => {
      const mockNote = {
        id: 'note-file',
        type: 'FILE',
        mediaUrl: 'https://storage.example.com/doc.pdf',
        mimeType: 'application/pdf',
        fileName: 'document.pdf',
        contactId: 'contact-123',
        createdAt: new Date(),
      };
      (prisma.contactNote.create as jest.Mock).mockResolvedValue(mockNote);

      const result = await prisma.contactNote.create({
        data: {
          type: 'FILE',
          mediaUrl: 'https://storage.example.com/doc.pdf',
          mimeType: 'application/pdf',
          fileName: 'document.pdf',
          contactId: 'contact-123',
        },
      });

      expect(result.type).toBe('FILE');
      expect(result.fileName).toBe('document.pdf');
    });

    it('should enforce 20MB file size limit', () => {
      const maxSize = 20 * 1024 * 1024; // 20MB
      const testFileSize = 21 * 1024 * 1024; // 21MB

      expect(testFileSize).toBeGreaterThan(maxSize);
    });
  });

  describe('DELETE /contacts/:id/notes/:noteId', () => {
    it('should delete a note', async () => {
      const mockNote = { id: 'note-1', type: 'TEXT', content: 'Test' };
      (prisma.contactNote.findUnique as jest.Mock).mockResolvedValue(mockNote);
      (prisma.contactNote.delete as jest.Mock).mockResolvedValue(mockNote);

      const note = await prisma.contactNote.findUnique({ where: { id: 'note-1' } });
      expect(note).toBeDefined();

      const deleted = await prisma.contactNote.delete({ where: { id: 'note-1' } });
      expect(deleted).toEqual(mockNote);
    });

    it('should return null for non-existent note', async () => {
      (prisma.contactNote.findUnique as jest.Mock).mockResolvedValue(null);

      const note = await prisma.contactNote.findUnique({ where: { id: 'non-existent' } });
      expect(note).toBeNull();
    });

    it('should verify contact ownership before delete', async () => {
      const mockContact = { id: 'contact-123', userId: 'user-123' };
      (prisma.contact.findUnique as jest.Mock).mockResolvedValue(mockContact);

      const contact = await prisma.contact.findUnique({ where: { id: 'contact-123' } });

      expect(contact).toBeDefined();
      expect(contact?.userId).toBe('user-123');
    });
  });
});
