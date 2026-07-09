import { ContractType, JobStatus } from '@prisma/client';
import { ListJobsUseCase } from './list-jobs.use-case';
import { ListJobsQueryDto } from '../dto/list-jobs-query.dto';

describe('ListJobsUseCase', () => {
  let useCase: ListJobsUseCase;
  let mockPrisma: any;

  const now = new Date();

  const mockJob = {
    id: 'job-1',
    title: 'Cozinheiro',
    description: 'Responsável pela preparação dos pratos',
    requirements: 'Experiência mínima de 2 anos',
    salary: { toString: () => '3000.00' },
    contractType: ContractType.CLT,
    status: JobStatus.ABERTA,
    restaurantId: 'restaurant-1',
    restaurant: {
      restaurantName: 'Restaurante Exemplo',
      logoUrl: 'https://example.com/logo.png',
    },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    active: true,
  };

  beforeEach(() => {
    mockPrisma = {
      job: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    useCase = new ListJobsUseCase(mockPrisma);
  });

  describe('execute', () => {
    it('should return a list of open jobs with pagination metadata', async () => {
      const query: ListJobsQueryDto = { skip: 0, take: 20 };

      mockPrisma.job.findMany.mockResolvedValue([mockJob]);
      mockPrisma.job.count.mockResolvedValue(1);

      const result = await useCase.execute(query);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.skip).toBe(0);
      expect(result.take).toBe(20);

      const job = result.data[0];
      expect(job.id).toBe('job-1');
      expect(job.title).toBe('Cozinheiro');
      expect(job.status).toBe(JobStatus.ABERTA);
      expect(job.restaurant.restaurantName).toBe('Restaurante Exemplo');
      expect(job.restaurant.logoUrl).toBe('https://example.com/logo.png');
      expect(job.salary).toBe('3000.00');
    });

    it('should use default pagination values when not provided', async () => {
      const query: ListJobsQueryDto = {};

      mockPrisma.job.findMany.mockResolvedValue([]);
      mockPrisma.job.count.mockResolvedValue(0);

      const result = await useCase.execute(query);

      expect(result.skip).toBe(0);
      expect(result.take).toBe(20);
    });

    it('should return null salary when job has no salary defined', async () => {
      const query: ListJobsQueryDto = { skip: 0, take: 20 };

      const jobWithoutSalary = { ...mockJob, salary: null };
      mockPrisma.job.findMany.mockResolvedValue([jobWithoutSalary]);
      mockPrisma.job.count.mockResolvedValue(1);

      const result = await useCase.execute(query);

      expect(result.data[0].salary).toBeNull();
    });

    it('should return empty data when no open jobs exist', async () => {
      const query: ListJobsQueryDto = { skip: 0, take: 20 };

      mockPrisma.job.findMany.mockResolvedValue([]);
      mockPrisma.job.count.mockResolvedValue(0);

      const result = await useCase.execute(query);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should respect custom skip and take values', async () => {
      const query: ListJobsQueryDto = { skip: 10, take: 5 };

      mockPrisma.job.findMany.mockResolvedValue([]);
      mockPrisma.job.count.mockResolvedValue(0);

      const result = await useCase.execute(query);

      expect(result.skip).toBe(10);
      expect(result.take).toBe(5);
    });
  });
});
