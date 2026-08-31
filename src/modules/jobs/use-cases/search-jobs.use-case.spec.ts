import { ContractType, JobStatus } from '@prisma/client';
import { SearchJobsUseCase } from './search-jobs.use-case';
import { SearchJobsQueryDto } from '../dto/search-jobs-query.dto';

describe('SearchJobsUseCase', () => {
    let useCase: SearchJobsUseCase;
    let mockPrisma: any;

    const now = new Date();

    const mockJob = {
        id: 'job-1',
        title: 'Chef de cozinha',
        description: 'Preparação de pratos gourmet',
        requirements: 'Experiência mínima de 2 anos',
        salary: { toString: () => '5000.00' },
        contractType: ContractType.CLT,
        status: JobStatus.ABERTA,
        restaurantId: 'restaurant-1',
        restaurant: {
            restaurantName: 'Restaurante Exemplo',
            logoUrl: 'https://example.com/logo.png',
        },
        createdAt: now,
    };

    beforeEach(() => {
        mockPrisma = {
            job: {
                findMany: jest.fn(),
                count: jest.fn(),
            },
        };

        useCase = new SearchJobsUseCase(mockPrisma);
    });

    it('should apply all filters dynamically and return paginated results', async () => {
        const query: SearchJobsQueryDto = {
            termo: 'chef',
            tipoContrato: ContractType.CLT,
            salarioMinimo: 4000,
            skip: 0,
            take: 10,
        };

        mockPrisma.job.findMany.mockResolvedValue([mockJob]);
        mockPrisma.job.count.mockResolvedValue(1);

        const result = await useCase.execute(query);

        expect(result.data).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.skip).toBe(0);
        expect(result.take).toBe(10);
        expect(result.data[0].title).toBe('Chef de cozinha');
        expect(result.data[0].contractType).toBe(ContractType.CLT);
        expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: JobStatus.ABERTA,
                    active: true,
                    contractType: ContractType.CLT,
                    salary: { gte: expect.any(Object) },
                }),
            }),
        );
    });

    it('should keep the default open jobs feed when no filters are provided', async () => {
        const query: SearchJobsQueryDto = { skip: 0, take: 20 };

        mockPrisma.job.findMany.mockResolvedValue([]);
        mockPrisma.job.count.mockResolvedValue(0);

        const result = await useCase.execute(query);

        expect(result.data).toEqual([]);
        expect(result.total).toBe(0);
        expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: JobStatus.ABERTA,
                    active: true,
                }),
                orderBy: { createdAt: 'desc' },
            }),
        );
    });
});
