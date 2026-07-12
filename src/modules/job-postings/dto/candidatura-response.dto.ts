import { Expose } from 'class-transformer';

export class CandidaturaResponseDto {
  @Expose()
  id: string;

  @Expose()
  vagaId: string;

  @Expose()
  profissionalId: string;

  @Expose()
  createdAt: Date;

  constructor(partial: Partial<CandidaturaResponseDto>) {
    Object.assign(this, partial);
  }
}