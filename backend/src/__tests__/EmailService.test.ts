/**
 * EmailService Unit Tests
 */

import { EmailService } from '../infrastructure/services/EmailService';

// Mock nodemailer
const mockSendMail = jest.fn();
const mockVerify = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
    verify: mockVerify,
  })),
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

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    // Set SMTP env vars for transporter to be created
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'testpass';

    service = new EmailService();
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });
    mockVerify.mockImplementation((callback) => callback(null));
  });

  afterEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  describe('sendVerificationEmail', () => {
    it('should send verification email successfully', async () => {
      const result = await service.sendVerificationEmail(
        'test@example.com',
        {
          name: 'Test User',
          verificationUrl: 'https://example.com/verify/token-123',
          expiresIn: '24 hours',
        }
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('Verify'),
        })
      );
      expect(result).toBe(true);
    });

    it('should include verification URL in email', async () => {
      await service.sendVerificationEmail(
        'test@example.com',
        {
          name: 'Test User',
          verificationUrl: 'https://example.com/verify/verification-token-123',
          expiresIn: '24 hours',
        }
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('verification-token-123'),
        })
      );
    });

    it('should handle send failure', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await service.sendVerificationEmail(
        'test@example.com',
        {
          name: 'Test User',
          verificationUrl: 'https://example.com/verify/token',
          expiresIn: '24 hours',
        }
      );

      expect(result).toBe(false);
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email successfully', async () => {
      const result = await service.sendPasswordResetEmail(
        'test@example.com',
        {
          name: 'Test User',
          resetUrl: 'https://example.com/reset/reset-token-456',
          expiresIn: '1 hour',
        }
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('Reset'),
        })
      );
      expect(result).toBe(true);
    });

    it('should include reset URL in email', async () => {
      await service.sendPasswordResetEmail(
        'test@example.com',
        {
          name: 'Test User',
          resetUrl: 'https://example.com/reset/reset-token-456',
          expiresIn: '1 hour',
        }
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('reset-token-456'),
        })
      );
    });

    it('should handle send failure', async () => {
      mockSendMail.mockRejectedValue(new Error('Connection refused'));

      const result = await service.sendPasswordResetEmail(
        'test@example.com',
        {
          name: 'Test User',
          resetUrl: 'https://example.com/reset/token',
          expiresIn: '1 hour',
        }
      );

      expect(result).toBe(false);
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email successfully', async () => {
      const result = await service.sendWelcomeEmail(
        'test@example.com',
        {
          name: 'Test User',
          loginUrl: 'https://example.com/login',
        }
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('Welcome'),
        })
      );
      expect(result).toBe(true);
    });

    it('should personalize with user name', async () => {
      await service.sendWelcomeEmail(
        'test@example.com',
        {
          name: 'John',
          loginUrl: 'https://example.com/login',
        }
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('John'),
        })
      );
    });
  });

  describe('sendEmail', () => {
    it('should send custom email', async () => {
      const result = await service.sendEmail({
        to: 'recipient@example.com',
        subject: 'Custom Subject',
        html: '<p>Custom content</p>',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: 'Custom Subject',
          html: '<p>Custom content</p>',
        })
      );
      expect(result).toBe(true);
    });

    it('should support plain text emails', async () => {
      const result = await service.sendEmail({
        to: 'recipient@example.com',
        subject: 'Plain Text',
        html: '<p>HTML content</p>',
        text: 'This is plain text content',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'This is plain text content',
        })
      );
      expect(result).toBe(true);
    });
  });

  describe('when SMTP is not configured', () => {
    it('should return false when sending email', async () => {
      // Create service without SMTP config
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const unconfiguredService = new EmailService();

      const result = await unconfiguredService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result).toBe(false);
    });
  });
});
