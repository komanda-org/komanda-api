import { CandidaturaStatus } from '@prisma/client';

/** Recorte da vaga exposto no histórico do profissional. */
export interface MyApplicationJobDto {
  id: string;
  title: string;
}

/** Recorte do estabelecimento dono da vaga. */
export interface MyApplicationRestaurantDto {
  id: string;
  name: string;
}

export interface MyApplicationDto {
  applicationId: string;
  status: CandidaturaStatus;
  applicationDate: Date;
  job: MyApplicationJobDto;
  restaurant: MyApplicationRestaurantDto;
}

export interface ListMyApplicationsResponseDto {
  data: MyApplicationDto[];
  total: number;
  skip: number;
  take: number;
}
