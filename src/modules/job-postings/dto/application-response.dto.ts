import { Expose } from 'class-transformer';

export class ApplicationResponseDto {
  @Expose()
  id: string;

  @Expose()
  vagaId: string;

  @Expose()
  profissionalId: string;

  @Expose()
  createdAt: Date;

  constructor(partial: Partial<ApplicationResponseDto>) {
    Object.assign(this, partial);
  }
}
