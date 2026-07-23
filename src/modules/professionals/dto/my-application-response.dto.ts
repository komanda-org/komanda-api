import { CandidaturaStatus } from '@prisma/client';

/** Recorte da vaga exposto no histórico do profissional. */
export interface MyApplicationVagaDto {
  id: string;
  titulo: string;
}

/** Recorte do estabelecimento dono da vaga. */
export interface MyApplicationRestauranteDto {
  id: string;
  nome: string;
}

export interface MyApplicationDto {
  candidaturaId: string;
  status: CandidaturaStatus;
  dataCandidatura: Date;
  vaga: MyApplicationVagaDto;
  restaurante: MyApplicationRestauranteDto;
}

export interface ListMyApplicationsResponseDto {
  data: MyApplicationDto[];
  total: number;
  skip: number;
  take: number;
}
