import { Expose } from 'class-transformer';
import { CandidaturaStatus } from '@prisma/client';

export class ApplicationStatusResponseDto {
  @Expose()
  id: string;

  @Expose()
  jobId: string;

  @Expose()
  professionalId: string;

  @Expose()
  status: CandidaturaStatus;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<ApplicationStatusResponseDto>) {
    Object.assign(this, partial);
  }
}
