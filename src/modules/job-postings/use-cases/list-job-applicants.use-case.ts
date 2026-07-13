import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CandidaturaStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListJobApplicantsResponseDto } from '../dto/job-applicant-response.dto';

interface ListJobApplicantsInput {
  vagaId: string;
  restauranteId: string;
  status?: CandidaturaStatus;
  skip?: number;
  take?: number;
}

@Injectable()
export class ListJobApplicantsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    input: ListJobApplicantsInput,
  ): Promise<ListJobApplicantsResponseDto> {
    const skip = input.skip ?? 0;
    const take = input.take ?? 20;

    const vaga = await this.prisma.job.findUnique({
      where: { id: input.vagaId },
      select: { restaurantId: true, active: true, deletedAt: true },
    });

    // Vaga excluída logicamente é indistinguível de inexistente para a API.
    if (!vaga || !vaga.active || vaga.deletedAt) {
      throw new NotFoundException('Vaga não encontrada');
    }

    // O restauranteId vem do token: um restaurante não enxerga candidatos de vaga alheia.
    if (vaga.restaurantId !== input.restauranteId) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar os candidatos desta vaga',
      );
    }

    const where: Prisma.CandidaturaWhereInput = {
      jobId: input.vagaId,
      ...(input.status ? { status: input.status } : {}),
    };

    const [candidaturas, total] = await Promise.all([
      this.prisma.candidatura.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          createdAt: true,
          // Só os campos públicos do perfil — o resto do model (e o User com
          // passwordHash) nunca sai do banco.
          professional: {
            select: {
              userId: true,
              fullName: true,
              mainRole: true,
              profilePhoto: true,
              experienceSummary: true,
              averageRating: true,
            },
          },
        },
      }),
      this.prisma.candidatura.count({ where }),
    ]);

    return {
      data: candidaturas.map((candidatura) => ({
        candidaturaId: candidatura.id,
        status: candidatura.status,
        dataCandidatura: candidatura.createdAt,
        profissional: {
          id: candidatura.professional.userId,
          nomeCompleto: candidatura.professional.fullName,
          cargoPrincipal: candidatura.professional.mainRole,
          fotoPerfil: candidatura.professional.profilePhoto,
          resumoExperiencias: candidatura.professional.experienceSummary,
          avaliacaoMedia: candidatura.professional.averageRating,
        },
      })),
      total,
      skip,
      take,
    };
  }
}
