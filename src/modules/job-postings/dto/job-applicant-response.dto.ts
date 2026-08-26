import { CandidaturaStatus } from '@prisma/client';

/** Recorte público do perfil do profissional exposto ao restaurante. */
export interface JobApplicantProfileDto {
  id: string;
  fullName: string;
  mainRole: string;
  profilePhoto: string | null;
  experienceSummary: string | null;
  averageRating: number | null;
}

export interface JobApplicantDto {
  applicationId: string;
  status: CandidaturaStatus;
  applicationDate: Date;
  professional: JobApplicantProfileDto;
}

export interface ListJobApplicantsResponseDto {
  data: JobApplicantDto[];
  total: number;
  skip: number;
  take: number;
}
