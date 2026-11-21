import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchProfessionalsQueryDto } from '../dto/search-professionals-query.dto';
import { SearchProfessionalsResponseDto } from '../dto/professional-search-response.dto';

@Injectable()
export class SearchProfessionalsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: SearchProfessionalsQueryDto,
  ): Promise<SearchProfessionalsResponseDto> {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;

    const where: Prisma.ProfessionalWhereInput = {
      active: true,
      deletedAt: null,
      // A exclusão de conta é soft-delete no User: quem excluiu sai da busca.
      user: { active: true, deletedAt: null },
      ...(query.position
        ? { mainRole: { contains: query.position, mode: 'insensitive' } }
        : {}),
    };

    const [professionals, total] = await Promise.all([
      this.prisma.professional.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        // Só os campos públicos do perfil — o resto do model (e o User com
        // email/passwordHash) nunca sai do banco.
        select: {
          userId: true,
          fullName: true,
          mainRole: true,
          interestedRoles: true,
          profilePhoto: true,
          experienceSummary: true,
          neighborhood: true,
          averageRating: true,
        },
      }),
      this.prisma.professional.count({ where }),
    ]);

    return {
      data: professionals.map(({ userId, ...rest }) => ({
        id: userId,
        ...rest,
      })),
      total,
      skip,
      take,
    };
  }
}
