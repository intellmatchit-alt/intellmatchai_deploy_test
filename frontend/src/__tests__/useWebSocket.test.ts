/**
 * useWebSocket Hook Tests
 *
 * Tests for the WebSocket hook including project match events.
 */

import { renderHook, act } from '@testing-library/react';

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  connected: true,
};

const mockIo = jest.fn(() => mockSocket);

jest.mock('socket.io-client', () => ({
  io: mockIo,
}));

// Mock useAuth
const mockUser = { id: 'user-123', email: 'test@example.com' };
jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
  }),
}));

import {
  useWebSocket,
  ProjectMatchProgressEvent,
  ProjectMatchCompleteEvent,
} from '../hooks/useWebSocket';

describe('useWebSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.connected = true;
  });

  describe('connection', () => {
    it('should connect when authenticated', () => {
      renderHook(() => useWebSocket());

      expect(mockIo).toHaveBeenCalled();
    });

    it('should authenticate with userId on connect', () => {
      let connectHandler: () => void = () => {};
      mockSocket.on.mockImplementation((event: string, handler: () => void) => {
        if (event === 'connect') {
          connectHandler = handler;
        }
      });

      renderHook(() => useWebSocket());

      act(() => {
        connectHandler();
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('authenticate', { userId: 'user-123' });
    });
  });

  describe('project match events', () => {
    it('should register project:match:progress handler', () => {
      const onProjectMatchProgress = jest.fn();

      renderHook(() =>
        useWebSocket({
          onProjectMatchProgress,
        })
      );

      expect(mockSocket.on).toHaveBeenCalledWith(
        'project:match:progress',
        expect.any(Function)
      );
    });

    it('should register project:match:complete handler', () => {
      const onProjectMatchComplete = jest.fn();

      renderHook(() =>
        useWebSocket({
          onProjectMatchComplete,
        })
      );

      expect(mockSocket.on).toHaveBeenCalledWith(
        'project:match:complete',
        expect.any(Function)
      );
    });

    it('should call onProjectMatchProgress when event received', () => {
      const onProjectMatchProgress = jest.fn();
      let progressHandler: (event: ProjectMatchProgressEvent) => void = () => {};

      mockSocket.on.mockImplementation(
        (event: string, handler: (event: ProjectMatchProgressEvent) => void) => {
          if (event === 'project:match:progress') {
            progressHandler = handler;
          }
        }
      );

      renderHook(() =>
        useWebSocket({
          onProjectMatchProgress,
        })
      );

      const mockEvent: ProjectMatchProgressEvent = {
        projectId: 'project-1',
        progress: 50,
        status: 'Extracting keywords...',
        timestamp: new Date().toISOString(),
      };

      act(() => {
        progressHandler(mockEvent);
      });

      expect(onProjectMatchProgress).toHaveBeenCalledWith(mockEvent);
    });

    it('should call onProjectMatchComplete when event received', () => {
      const onProjectMatchComplete = jest.fn();
      let completeHandler: (event: ProjectMatchCompleteEvent) => void = () => {};

      mockSocket.on.mockImplementation(
        (event: string, handler: (event: ProjectMatchCompleteEvent) => void) => {
          if (event === 'project:match:complete') {
            completeHandler = handler;
          }
        }
      );

      renderHook(() =>
        useWebSocket({
          onProjectMatchComplete,
        })
      );

      const mockEvent: ProjectMatchCompleteEvent = {
        projectId: 'project-1',
        matchCount: 10,
        status: 'completed',
        timestamp: new Date().toISOString(),
      };

      act(() => {
        completeHandler(mockEvent);
      });

      expect(onProjectMatchComplete).toHaveBeenCalledWith(mockEvent);
    });

    it('should handle failed match completion', () => {
      const onProjectMatchComplete = jest.fn();
      let completeHandler: (event: ProjectMatchCompleteEvent) => void = () => {};

      mockSocket.on.mockImplementation(
        (event: string, handler: (event: ProjectMatchCompleteEvent) => void) => {
          if (event === 'project:match:complete') {
            completeHandler = handler;
          }
        }
      );

      renderHook(() =>
        useWebSocket({
          onProjectMatchComplete,
        })
      );

      const mockEvent: ProjectMatchCompleteEvent = {
        projectId: 'project-1',
        matchCount: 0,
        status: 'failed',
        error: 'AI service unavailable',
        timestamp: new Date().toISOString(),
      };

      act(() => {
        completeHandler(mockEvent);
      });

      expect(onProjectMatchComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: 'AI service unavailable',
        })
      );
    });
  });

  describe('other events', () => {
    it('should register enrichment:progress handler', () => {
      const onEnrichmentProgress = jest.fn();

      renderHook(() =>
        useWebSocket({
          onEnrichmentProgress,
        })
      );

      expect(mockSocket.on).toHaveBeenCalledWith('enrichment:progress', expect.any(Function));
    });

    it('should register enrichment:complete handler', () => {
      const onEnrichmentComplete = jest.fn();

      renderHook(() =>
        useWebSocket({
          onEnrichmentComplete,
        })
      );

      expect(mockSocket.on).toHaveBeenCalledWith('enrichment:complete', expect.any(Function));
    });

    it('should register match:updated handler', () => {
      const onMatchUpdate = jest.fn();

      renderHook(() =>
        useWebSocket({
          onMatchUpdate,
        })
      );

      expect(mockSocket.on).toHaveBeenCalledWith('match:updated', expect.any(Function));
    });
  });

  describe('disconnect', () => {
    it('should disconnect on unmount', () => {
      const { unmount } = renderHook(() => useWebSocket());

      unmount();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('subscriptions', () => {
    it('should provide subscribeToEnrichment function', () => {
      const { result } = renderHook(() => useWebSocket());

      expect(result.current.subscribeToEnrichment).toBeDefined();
    });

    it('should emit subscribe:enrichment on subscribeToEnrichment', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.subscribeToEnrichment('contact-1');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:enrichment', {
        contactId: 'contact-1',
      });
    });

    it('should provide subscribeToMatches function', () => {
      const { result } = renderHook(() => useWebSocket());

      expect(result.current.subscribeToMatches).toBeDefined();
    });
  });
});
