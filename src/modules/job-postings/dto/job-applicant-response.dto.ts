import { CandidaturaStatus } from '@prisma/client';

/** Recorte público do perfil do profissional exposto ao restaurante. */
export interface JobApplicantProfileDto {
  id: string;
  nomeCompleto: string;
  cargoPrincipal: string;
  fotoPerfil: string | null;
  resumoExperiencias: string | null;
  avaliacaoMedia: number | null;
}

export interface JobApplicantDto {
  candidaturaId: string;
  status: CandidaturaStatus;
  dataCandidatura: Date;
  profissional: JobApplicantProfileDto;
}

export interface ListJobApplicantsResponseDto {
  data: JobApplicantDto[];
  total: number;
  skip: number;
  take: number;
}
