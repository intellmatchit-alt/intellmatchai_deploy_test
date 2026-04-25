import { CreateDealUseCase } from '../application/use-cases/deal/CreateDealUseCase';
import { ValidationError } from '../shared/errors/index';
import { DealMode } from '../domain/entities/Deal';

const mockRepository = {
  create: jest.fn().mockResolvedValue({
    id: 'deal-1',
    mode: 'SELL',
    title: 'Test',
    status: 'DRAFT',
    createdAt: new Date(),
  }),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByUserId: jest.fn(),
};

describe('CreateDealUseCase', () => {
  let useCase: CreateDealUseCase;

  beforeEach(() => {
    useCase = new CreateDealUseCase(mockRepository as any);
    jest.clearAllMocks();
  });

  describe('SELL mode validation', () => {
    it('should succeed with productName', async () => {
      await expect(
        useCase.execute('user-1', { mode: DealMode.SELL, productName: 'Test Product' })
      ).resolves.toBeDefined();
    });

    it('should succeed with solutionType', async () => {
      await expect(
        useCase.execute('user-1', { mode: DealMode.SELL, solutionType: 'SaaS' })
      ).resolves.toBeDefined();
    });

    it('should succeed with both productName and solutionType', async () => {
      await expect(
        useCase.execute('user-1', { mode: DealMode.SELL, productName: 'CRM', solutionType: 'SaaS' })
      ).resolves.toBeDefined();
    });

    it('should fail without productName or solutionType', async () => {
      await expect(
        useCase.execute('user-1', { mode: DealMode.SELL, domain: 'Technology' })
      ).rejects.toThrow(ValidationError);
    });

    it('should fail with empty fields', async () => {
      await expect(
        useCase.execute('user-1', { mode: DealMode.SELL })
      ).rejects.toThrow(ValidationError);
    });

    it('should include error message about productName or solutionType', async () => {
      await expect(
        useCase.execute('user-1', { mode: DealMode.SELL })
      ).rejects.toThrow('productName or solutionType');
    });
  });

  describe('BUY mode validation', () => {
    it('should succeed with problemStatement', async () => {
      mockRepository.create.mockResolvedValueOnce({
        id: 'deal-2', mode: 'BUY', title: 'Test', status: 'DRAFT', createdAt: new Date(),
      });
      await expect(
        useCase.execute('user-1', { mode: DealMode.BUY, problemStatement: 'Need CRM' })
      ).resolves.toBeDefined();
    });

    it('should succeed with solutionType', async () => {
      mockRepository.create.mockResolvedValueOnce({
        id: 'deal-3', mode: 'BUY', title: 'Test', status: 'DRAFT', createdAt: new Date(),
      });
      await expect(
        useCase.execute('user-1', { mode: DealMode.BUY, solutionType: 'CRM' })
      ).resolves.toBeDefined();
    });

    it('should fail without problemStatement or solutionType', async () => {
      await expect(
        useCase.execute('user-1', { mode: DealMode.BUY, domain: 'Tech' })
      ).rejects.toThrow(ValidationError);
    });

    it('should fail with only domain', async () => {
      await expect(
        useCase.execute('user-1', { mode: DealMode.BUY, domain: 'Tech', companySize: 'SMALL' as any })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('mode validation', () => {
    it('should fail without mode', async () => {
      await expect(
        useCase.execute('user-1', { mode: '' as any, productName: 'Test' })
      ).rejects.toThrow(ValidationError);
    });

    it('should fail with null mode', async () => {
      await expect(
        useCase.execute('user-1', { mode: null as any, productName: 'Test' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('successful creation', () => {
    it('should call repository.create with correct data', async () => {
      await useCase.execute('user-1', {
        mode: DealMode.SELL,
        productName: 'CloudCRM',
        solutionType: 'SaaS',
        domain: 'Technology',
        companySize: 'MEDIUM' as any,
        targetDescription: 'Mid-size companies',
      });

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        mode: DealMode.SELL,
        productName: 'CloudCRM',
        solutionType: 'SaaS',
        domain: 'Technology',
        companySize: 'MEDIUM',
        targetDescription: 'Mid-size companies',
        title: undefined,
        problemStatement: undefined,
        targetEntityType: undefined,
      });
    });

    it('should return deal output with correct shape', async () => {
      const result = await useCase.execute('user-1', {
        mode: DealMode.SELL,
        productName: 'Test',
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('mode');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('createdAt');
    });
  });
});
