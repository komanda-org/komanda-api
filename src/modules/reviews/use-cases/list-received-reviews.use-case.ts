import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ListReviewsResponseDto,
  REMOVED_REVIEWER_NAME,
  ReviewerDto,
} from '../dto/review-response.dto';

const ACCOUNT_STATE = {
  active: true,
  deletedAt: true,
  user: { select: { active: true, deletedAt: true } },
} as const;

interface AccountState {
  active: boolean;
  deletedAt: Date | null;
  user: { active: boolean; deletedAt: Date | null };
}

const isAvailable = (account: AccountState) =>
  account.active &&
  !account.deletedAt &&
  account.user.active &&
  !account.user.deletedAt;

interface ListReceivedReviewsInput {
  userId: string;
  skip?: number;
  take?: number;
}

@Injectable()
export class ListReceivedReviewsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    input: ListReceivedReviewsInput,
  ): Promise<ListReviewsResponseDto> {
    const skip = input.skip ?? 0;
    const take = input.take ?? 20;

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { role: true, active: true, deletedAt: true },
    });

    // Usuário soft-deletado ou inativo é indistinguível de inexistente para a API.
    if (!user || !user.active || user.deletedAt) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // O recebedor da avaliação é sempre o lado oposto de quem a escreveu:
    // se :id é profissional, buscamos avaliações escritas por restaurantes
    // (e vice-versa).
    const isProfessional = user.role === Role.PROFISSIONAL;
    const where: Prisma.AvaliacaoWhereInput = isProfessional
      ? { professionalId: input.userId, avaliadorRole: Role.RESTAURANTE }
      : { restaurantId: input.userId, avaliadorRole: Role.PROFISSIONAL };

    const [reviews, total, aggregate] = await Promise.all([
      this.prisma.avaliacao.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          rating: true,
          comment: true,
          jobId: true,
          professionalId: true,
          restaurantId: true,
          createdAt: true,
          // Só o lado que escreveu é usado, mas os dois vêm na mesma consulta.
          professional: {
            select: { fullName: true, profilePhoto: true, ...ACCOUNT_STATE },
          },
          restaurant: {
            select: { restaurantName: true, logoUrl: true, ...ACCOUNT_STATE },
          },
        },
      }),
      this.prisma.avaliacao.count({ where }),
      this.prisma.avaliacao.aggregate({ where, _avg: { rating: true } }),
    ]);

    return {
      data: reviews.map((review) => {
        const reviewer: ReviewerDto = isProfessional
          ? {
              id: review.restaurantId,
              name: review.restaurant.restaurantName,
              photo: review.restaurant.logoUrl,
              role: Role.RESTAURANTE,
            }
          : {
              id: review.professionalId,
              name: review.professional.fullName,
              photo: review.professional.profilePhoto,
              role: Role.PROFISSIONAL,
            };
        const author = isProfessional ? review.restaurant : review.professional;
        if (!isAvailable(author)) {
          reviewer.name = REMOVED_REVIEWER_NAME;
          reviewer.photo = null;
        }

        return {
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          jobId: review.jobId,
          reviewerId: reviewer.id,
          reviewer,
          createdAt: review.createdAt,
        };
      }),
      total,
      skip,
      take,
      averageRating: aggregate._avg.rating,
    };
  }
}
