import { Expose } from 'class-transformer';

export class ApplicationResponseDto {
  @Expose()
  id: string;

  @Expose()
  jobId: string;

  @Expose()
  professionalId: string;

  @Expose()
  createdAt: Date;

  constructor(partial: Partial<ApplicationResponseDto>) {
    Object.assign(this, partial);
  }
}
