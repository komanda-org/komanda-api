export interface AvaliacaoDto {
  id: string;
  rating: number;
  comment: string | null;
  jobId: string;
  avaliadorId: string;
  createdAt: Date;
}

export interface ListAvaliacoesResponseDto {
  data: AvaliacaoDto[];
  total: number;
  skip: number;
  take: number;
  averageRating: number | null;
}
