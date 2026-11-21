import type { Role } from '@prisma/client';

export const REMOVED_REVIEWER_NAME = 'Usuário removido';

// Quem escreveu a avaliação. Conta excluída: name = "Usuário removido" e photo null.
export interface ReviewerDto {
  id: string;
  name: string;
  photo: string | null;
  role: Role;
}

export interface ReviewDto {
  id: string;
  rating: number;
  comment: string | null;
  jobId: string;
  reviewerId: string;
  reviewer: ReviewerDto;
  createdAt: Date;
}

export interface ListReviewsResponseDto {
  data: ReviewDto[];
  total: number;
  skip: number;
  take: number;
  averageRating: number | null;
}
