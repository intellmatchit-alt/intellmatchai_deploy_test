/**
 * Jest Test Setup
 *
 * Global setup for all tests.
 */

// Mock environment variables (must be at least 32 chars for JWT_SECRET)
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
process.env.JWT_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock process.exit to prevent tests from exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`process.exit called with code ${code}`);
});

// Increase timeout for slower tests
jest.setTimeout(10000);

// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  mockExit.mockRestore();
});
