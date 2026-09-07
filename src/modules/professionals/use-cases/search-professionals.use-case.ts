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
      ...(query.cargo
        ? { mainRole: { contains: query.cargo, mode: 'insensitive' } }
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
      data: professionals.map((professional) => ({
        id: professional.userId,
        fullName: professional.fullName,
        mainRole: professional.mainRole,
        interestedRoles: professional.interestedRoles,
        profilePhoto: professional.profilePhoto,
        experienceSummary: professional.experienceSummary,
        neighborhood: professional.neighborhood,
        averageRating: professional.averageRating,
      })),
      total,
      skip,
      take,
    };
  }
}
