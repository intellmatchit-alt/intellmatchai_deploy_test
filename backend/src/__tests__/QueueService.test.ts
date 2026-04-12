/**
 * QueueService Unit Tests
 */

import { QueueService, QueueName, EnrichmentJobData, EmailJobData, ExportJobData } from '../infrastructure/queue/QueueService';

// Mock bullmq
jest.mock('bullmq', () => {
  const mockJob = {
    id: 'test-job-id',
    name: 'test-job',
    progress: 50,
    data: {},
    returnvalue: { success: true },
    failedReason: undefined,
    timestamp: Date.now(),
    processedOn: Date.now(),
    finishedOn: Date.now(),
    getState: jest.fn().mockResolvedValue('completed'),
  };

  const mockQueue = {
    add: jest.fn().mockResolvedValue(mockJob),
    getJob: jest.fn().mockResolvedValue(mockJob),
    getWaitingCount: jest.fn().mockResolvedValue(5),
    getActiveCount: jest.fn().mockResolvedValue(2),
    getCompletedCount: jest.fn().mockResolvedValue(100),
    getFailedCount: jest.fn().mockResolvedValue(3),
    getDelayedCount: jest.fn().mockResolvedValue(1),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    clean: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockWorker = {
    on: jest.fn().mockReturnThis(),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockQueueEvents = {
    close: jest.fn().mockResolvedValue(undefined),
  };

  return {
    Queue: jest.fn(() => mockQueue),
    Worker: jest.fn(() => mockWorker),
    QueueEvents: jest.fn(() => mockQueueEvents),
  };
});

// Mock config
jest.mock('../config/index.js', () => ({
  config: {
    redis: {
      url: 'redis://localhost:6379',
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

const { Queue, Worker, QueueEvents } = require('bullmq');

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(() => {
    service = new QueueService();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (service.isAvailable()) {
      await service.close();
    }
  });

  describe('initialize', () => {
    it('should initialize queues successfully', async () => {
      await service.initialize();

      expect(service.isAvailable()).toBe(true);
      expect(Queue).toHaveBeenCalled();
      expect(QueueEvents).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      await service.initialize();
      const callCount = Queue.mock.calls.length;

      await service.initialize();

      expect(Queue.mock.calls.length).toBe(callCount);
    });

    it('should create queues for all queue names', async () => {
      await service.initialize();

      const queueNames = Object.values(QueueName);
      expect(Queue.mock.calls.length).toBe(queueNames.length);
    });
  });

  describe('getQueue', () => {
    it('should return queue instance after initialization', async () => {
      await service.initialize();

      const queue = service.getQueue(QueueName.ENRICHMENT);

      expect(queue).not.toBeNull();
    });

    it('should return null for non-existent queue', async () => {
      await service.initialize();

      const queue = service.getQueue('non-existent' as QueueName);

      expect(queue).toBeNull();
    });
  });

  describe('addJob', () => {
    it('should add job to queue', async () => {
      await service.initialize();

      const job = await service.addJob(QueueName.ENRICHMENT, 'test-job', { contactId: '123' });

      expect(job).not.toBeNull();
      expect(job?.id).toBe('test-job-id');
    });

    it('should return null when queue not available', async () => {
      // Don't initialize

      const job = await service.addJob(QueueName.ENRICHMENT, 'test-job', {});

      expect(job).toBeNull();
    });

    it('should support job options', async () => {
      await service.initialize();
      const mockQueue = Queue.mock.results[0].value;

      await service.addJob(QueueName.EMAIL, 'send-email', { to: 'test@example.com' }, {
        delay: 1000,
        priority: 1,
        jobId: 'custom-id',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-email',
        { to: 'test@example.com' },
        expect.objectContaining({
          delay: 1000,
          priority: 1,
          jobId: 'custom-id',
        })
      );
    });
  });

  describe('addEnrichmentJob', () => {
    it('should add enrichment job with correct format', async () => {
      await service.initialize();

      const data: EnrichmentJobData = {
        contactId: 'contact-123',
        userId: 'user-456',
        fields: ['email', 'phone'],
      };

      const job = await service.addEnrichmentJob(data);

      expect(job).not.toBeNull();
    });
  });

  describe('addEmailJob', () => {
    it('should add email job', async () => {
      await service.initialize();

      const data: EmailJobData = {
        to: 'user@example.com',
        subject: 'Test Email',
        template: 'welcome',
        data: { name: 'John' },
      };

      const job = await service.addEmailJob(data);

      expect(job).not.toBeNull();
    });

    it('should support delay option', async () => {
      await service.initialize();

      const data: EmailJobData = {
        to: 'user@example.com',
        subject: 'Delayed Email',
        template: 'reminder',
        data: {},
      };

      await service.addEmailJob(data, { delay: 60000 });

      const mockQueue = service.getQueue(QueueName.EMAIL);
      expect(mockQueue?.add).toHaveBeenCalled();
    });
  });

  describe('addExportJob', () => {
    it('should add export job', async () => {
      await service.initialize();

      const data: ExportJobData = {
        userId: 'user-123',
        format: 'csv',
        contactIds: ['contact-1', 'contact-2'],
      };

      const job = await service.addExportJob(data);

      expect(job).not.toBeNull();
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      await service.initialize();

      const status = await service.getJobStatus(QueueName.ENRICHMENT, 'test-job-id');

      expect(status).not.toBeNull();
      expect(status?.id).toBe('test-job-id');
      expect(status?.status).toBe('completed');
      expect(status?.progress).toBe(50);
    });

    it('should return null for non-existent queue', async () => {
      await service.initialize();

      const status = await service.getJobStatus('non-existent' as QueueName, 'job-id');

      expect(status).toBeNull();
    });
  });

  describe('registerWorker', () => {
    it('should register worker for queue', async () => {
      await service.initialize();

      const processor = jest.fn();
      const worker = service.registerWorker(QueueName.ENRICHMENT, processor, {
        concurrency: 10,
      });

      expect(worker).not.toBeNull();
      expect(Worker).toHaveBeenCalled();
    });

    it('should return null when queue not available', async () => {
      const processor = jest.fn();
      const worker = service.registerWorker(QueueName.ENRICHMENT, processor);

      expect(worker).toBeNull();
    });

    it('should set up event handlers', async () => {
      await service.initialize();

      const processor = jest.fn();
      const worker = service.registerWorker(QueueName.EMAIL, processor);
      const mockWorker = Worker.mock.results[0].value;

      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      await service.initialize();

      const stats = await service.getQueueStats(QueueName.ENRICHMENT);

      expect(stats).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
      });
    });

    it('should return null for non-existent queue', async () => {
      await service.initialize();

      const stats = await service.getQueueStats('non-existent' as QueueName);

      expect(stats).toBeNull();
    });
  });

  describe('pauseQueue', () => {
    it('should pause queue', async () => {
      await service.initialize();
      const mockQueue = service.getQueue(QueueName.ENRICHMENT);

      await service.pauseQueue(QueueName.ENRICHMENT);

      expect(mockQueue?.pause).toHaveBeenCalled();
    });
  });

  describe('resumeQueue', () => {
    it('should resume queue', async () => {
      await service.initialize();
      const mockQueue = service.getQueue(QueueName.ENRICHMENT);

      await service.resumeQueue(QueueName.ENRICHMENT);

      expect(mockQueue?.resume).toHaveBeenCalled();
    });
  });

  describe('cleanQueue', () => {
    it('should clean old jobs', async () => {
      await service.initialize();
      const mockQueue = service.getQueue(QueueName.ENRICHMENT);

      await service.cleanQueue(QueueName.ENRICHMENT);

      expect(mockQueue?.clean).toHaveBeenCalledTimes(2); // completed and failed
    });
  });

  describe('close', () => {
    it('should close all queues and workers', async () => {
      await service.initialize();

      await service.close();

      expect(service.isAvailable()).toBe(false);
    });
  });
});
