import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CandidaturaStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

interface CreateReviewInput {
  authorId: string;
  jobId: string;
  receiverId: string;
  rating: number;
  comment?: string;
}

@Injectable()
export class CreateReviewUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: CreateReviewInput) {
    const author = await this.prisma.user.findUnique({
      where: { id: input.authorId },
      select: { id: true, role: true, active: true, deletedAt: true },
    });

    if (!author || !author.active || author.deletedAt) {
      throw new ForbiddenException(
        'Você não pode avaliar usuários neste momento',
      );
    }

    const receiver = await this.prisma.user.findUnique({
      where: { id: input.receiverId },
      select: { id: true, role: true, active: true, deletedAt: true },
    });

    if (!receiver || !receiver.active || receiver.deletedAt) {
      throw new ForbiddenException('Usuário avaliado não encontrado');
    }

    const job = await this.prisma.job.findUnique({
      where: { id: input.jobId },
      select: { id: true, restaurantId: true, active: true, deletedAt: true },
    });

    if (!job || !job.active || job.deletedAt) {
      throw new NotFoundException('Vaga não encontrada');
    }

    const isProfessionalAuthor = author.role === Role.PROFISSIONAL;
    const isRestaurantAuthor = author.role === Role.RESTAURANTE;

    if (isProfessionalAuthor && input.receiverId !== job.restaurantId) {
      throw new ForbiddenException(
        'Você só pode avaliar o parceiro desta vaga',
      );
    }

    if (isRestaurantAuthor) {
      if (input.authorId !== job.restaurantId) {
        throw new ForbiddenException(
          'Você só pode avaliar o parceiro desta vaga',
        );
      }
      if (receiver.role !== Role.PROFISSIONAL) {
        throw new ForbiddenException(
          'Você só pode avaliar o parceiro desta vaga',
        );
      }
      if (input.receiverId === job.restaurantId) {
        throw new ForbiddenException(
          'Você só pode avaliar o parceiro desta vaga',
        );
      }
    }

    const approvedApplication = await this.prisma.candidatura.findFirst({
      where: {
        jobId: input.jobId,
        professionalId: isProfessionalAuthor
          ? input.authorId
          : input.receiverId,
        status: CandidaturaStatus.APROVADA,
      },
      select: { id: true },
    });

    if (!approvedApplication) {
      throw new ForbiddenException(
        'Só é possível avaliar após uma candidatura aprovada na vaga',
      );
    }

    const data = {
      rating: input.rating,
      comment: input.comment ?? null,
      avaliadorRole: author.role,
      professionalId: isProfessionalAuthor ? input.authorId : input.receiverId,
      restaurantId: isProfessionalAuthor ? input.receiverId : input.authorId,
      jobId: input.jobId,
    };

    try {
      const avaliacao = await this.prisma.avaliacao.create({ data });

      const receiverIsRestaurant = isProfessionalAuthor;

      // Só entram as notas RECEBIDAS: a tabela guarda as duas direções na
      // mesma linha (professionalId + restaurantId), então sem filtrar por
      // avaliadorRole a média misturaria as notas que o próprio recebedor deu.
      const aggregate = await this.prisma.avaliacao.aggregate({
        where: receiverIsRestaurant
          ? {
              restaurantId: data.restaurantId,
              avaliadorRole: Role.PROFISSIONAL,
            }
          : {
              professionalId: data.professionalId,
              avaliadorRole: Role.RESTAURANTE,
            },
        _avg: { rating: true },
      });

      if (receiverIsRestaurant) {
        await this.prisma.restaurant.update({
          where: { userId: data.restaurantId },
          data: { averageRating: aggregate._avg.rating },
        });
      } else {
        await this.prisma.professional.update({
          where: { userId: data.professionalId },
          data: { averageRating: aggregate._avg.rating },
        });
      }

      return avaliacao;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Você já avaliou este recebedor nesta vaga',
        );
      }
      throw error;
    }
  }
}
