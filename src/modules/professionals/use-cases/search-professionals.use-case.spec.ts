import { SearchProfessionalsUseCase } from './search-professionals.use-case';
import { SearchProfessionalsQueryDto } from '../dto/search-professionals-query.dto';

describe('SearchProfessionalsUseCase', () => {
  let useCase: SearchProfessionalsUseCase;
  let mockPrisma: any;

  const mockProfessional = {
    userId: 'professional-1',
    fullName: 'Maria Souza',
    mainRole: 'Cozinheira',
    interestedRoles: ['Cozinheira', 'Confeiteira'],
    profilePhoto: 'https://example.com/photo.png',
    experienceSummary: '5 anos de experiência em cozinha italiana',
    neighborhood: 'Centro',
    averageRating: 4.5,
  };

  beforeEach(() => {
    mockPrisma = {
      professional: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    useCase = new SearchProfessionalsUseCase(mockPrisma);
  });

  describe('execute', () => {
    it('retorna profissionais ativos paginados quando nenhum cargo é informado', async () => {
      const query: SearchProfessionalsQueryDto = { skip: 0, take: 20 };

      mockPrisma.professional.findMany.mockResolvedValue([mockProfessional]);
      mockPrisma.professional.count.mockResolvedValue(1);

      const result = await useCase.execute(query);

      expect(mockPrisma.professional.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { active: true, deletedAt: null },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: 'professional-1',
        fullName: 'Maria Souza',
        mainRole: 'Cozinheira',
        interestedRoles: ['Cozinheira', 'Confeiteira'],
        profilePhoto: 'https://example.com/photo.png',
        experienceSummary: '5 anos de experiência em cozinha italiana',
        neighborhood: 'Centro',
        averageRating: 4.5,
      });
      expect(result.total).toBe(1);
      expect(result.skip).toBe(0);
      expect(result.take).toBe(20);
    });

    it('aplica o filtro de cargo de forma case insensitive', async () => {
      const query: SearchProfessionalsQueryDto = { position: 'cozinheiro' };

      mockPrisma.professional.findMany.mockResolvedValue([]);
      mockPrisma.professional.count.mockResolvedValue(0);

      await useCase.execute(query);

      expect(mockPrisma.professional.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            active: true,
            deletedAt: null,
            mainRole: { contains: 'cozinheiro', mode: 'insensitive' },
          },
        }),
      );
      expect(mockPrisma.professional.count).toHaveBeenCalledWith({
        where: {
          active: true,
          deletedAt: null,
          mainRole: { contains: 'cozinheiro', mode: 'insensitive' },
        },
      });
    });

    it('nunca seleciona campos sensíveis do profissional', async () => {
      const query: SearchProfessionalsQueryDto = {};

      mockPrisma.professional.findMany.mockResolvedValue([]);
      mockPrisma.professional.count.mockResolvedValue(0);

      await useCase.execute(query);

      const call = mockPrisma.professional.findMany.mock.calls[0][0];
      expect(call.select).toEqual({
        userId: true,
        fullName: true,
        mainRole: true,
        interestedRoles: true,
        profilePhoto: true,
        experienceSummary: true,
        neighborhood: true,
        averageRating: true,
      });
    });

    it('usa os valores padrão de paginação quando não informados', async () => {
      const query: SearchProfessionalsQueryDto = {};

      mockPrisma.professional.findMany.mockResolvedValue([]);
      mockPrisma.professional.count.mockResolvedValue(0);

      const result = await useCase.execute(query);

      expect(result.skip).toBe(0);
      expect(result.take).toBe(20);
    });

    it('respeita valores customizados de skip e take', async () => {
      const query: SearchProfessionalsQueryDto = { skip: 10, take: 5 };

      mockPrisma.professional.findMany.mockResolvedValue([]);
      mockPrisma.professional.count.mockResolvedValue(0);

      const result = await useCase.execute(query);

      expect(result.skip).toBe(10);
      expect(result.take).toBe(5);
    });

    it('retorna lista vazia quando nenhum profissional é encontrado', async () => {
      const query: SearchProfessionalsQueryDto = { position: 'Sommelier' };

      mockPrisma.professional.findMany.mockResolvedValue([]);
      mockPrisma.professional.count.mockResolvedValue(0);

      const result = await useCase.execute(query);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
