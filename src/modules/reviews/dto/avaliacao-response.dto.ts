export interface AvaliacaoDto {
  id: string;
  nota: number;
  comentario: string | null;
  avaliadorId: string;
  createdAt: Date;
}

export interface ListAvaliacoesResponseDto {
  data: AvaliacaoDto[];
  total: number;
  skip: number;
  take: number;
  mediaNotas: number | null;
}
