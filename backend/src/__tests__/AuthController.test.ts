/**
 * AuthController Unit Tests
 */

import { Request, Response, NextFunction } from 'express';

// Must define mocks before importing the module
jest.mock('../application/use-cases/auth/index.js', () => ({
  registerUseCase: { execute: jest.fn() },
  loginUseCase: { execute: jest.fn() },
  refreshTokenUseCase: { execute: jest.fn() },
  logoutUseCase: { execute: jest.fn() },
}));

jest.mock('../infrastructure/database/prisma/client.js', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    verificationToken: {
      findFirst: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('../infrastructure/services/EmailService.js', () => ({
  emailService: {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  },
}));

jest.mock('../shared/logger/index.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Import after mocks
import { AuthController } from '../presentation/controllers/AuthController';
import {
  registerUseCase,
  loginUseCase,
  refreshTokenUseCase,
  logoutUseCase,
} from '../application/use-cases/auth/index';
import { prisma } from '../infrastructure/database/prisma/client';

describe('AuthController', () => {
  let controller: AuthController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    controller = new AuthController();
    mockReq = {
      body: {},
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
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

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
      };

      mockReq.body = {
        email: 'test@example.com',
        password: 'Password123!@#',
        fullName: 'Test User',
      };

      (registerUseCase.execute as jest.Mock).mockResolvedValue({
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      await controller.register(mockReq as Request, mockRes as Response, mockNext);

      expect(registerUseCase.execute).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should handle registration errors', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'short',
        fullName: 'Test User',
      };

      (registerUseCase.execute as jest.Mock).mockRejectedValue(new Error('Password too short'));

      await controller.register(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
      };

      mockReq.body = {
        email: 'test@example.com',
        password: 'Password123!@#',
      };

      (loginUseCase.execute as jest.Mock).mockResolvedValue({
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      await controller.login(mockReq as Request, mockRes as Response, mockNext);

      expect(loginUseCase.execute).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle invalid credentials', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'wrong-password',
      };

      (loginUseCase.execute as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));

      await controller.login(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      mockReq.body = { refreshToken: 'valid-refresh-token' };

      (refreshTokenUseCase.execute as jest.Mock).mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      await controller.refreshToken(mockReq as Request, mockRes as Response, mockNext);

      expect(refreshTokenUseCase.execute).toHaveBeenCalledWith('valid-refresh-token');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 when no refresh token provided', async () => {
      mockReq.body = {};

      await controller.refreshToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      mockReq.body = { refreshToken: 'valid-refresh-token' };

      (logoutUseCase.execute as jest.Mock).mockResolvedValue(undefined);

      await controller.logout(mockReq as Request, mockRes as Response, mockNext);

      expect(logoutUseCase.execute).toHaveBeenCalledWith('valid-refresh-token');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      mockReq.params = { token: 'valid-token' };

      (prisma.verificationToken.findFirst as jest.Mock).mockResolvedValue({
        id: 'token-id',
        token: 'valid-token',
        type: 'EMAIL_VERIFICATION',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 3600000),
      });

      (prisma.user.update as jest.Mock).mockResolvedValue({ emailVerified: true });
      (prisma.verificationToken.delete as jest.Mock).mockResolvedValue({});

      await controller.verifyEmail(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.user.update).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 for invalid token', async () => {
      mockReq.params = { token: 'invalid-token' };

      (prisma.verificationToken.findFirst as jest.Mock).mockResolvedValue(null);

      await controller.verifyEmail(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email', async () => {
      mockReq.body = { email: 'test@example.com' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
      });

      (prisma.verificationToken.create as jest.Mock).mockResolvedValue({ token: 'reset-token' });

      await controller.forgotPassword(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return success even for non-existent email', async () => {
      mockReq.body = { email: 'nonexistent@example.com' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await controller.forgotPassword(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      mockReq.body = {
        token: 'valid-reset-token',
        password: 'NewPassword123!@#',
      };

      (prisma.verificationToken.findFirst as jest.Mock).mockResolvedValue({
        id: 'token-id',
        token: 'valid-reset-token',
        type: 'PASSWORD_RESET',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 3600000),
      });

      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.verificationToken.delete as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({});

      await controller.resetPassword(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.user.update).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 for invalid reset token', async () => {
      mockReq.body = {
        token: 'invalid-token',
        password: 'NewPassword123!@#',
      };

      (prisma.verificationToken.findFirst as jest.Mock).mockResolvedValue(null);

      await controller.resetPassword(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
