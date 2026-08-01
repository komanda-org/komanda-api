import { IsEnum } from 'class-validator';
import { CandidaturaStatus } from '@prisma/client';

export class UpdateApplicationStatusDto {
  @IsEnum(CandidaturaStatus, {
    message: 'status deve ser PENDENTE, APROVADA ou REJEITADA',
  })
  status: CandidaturaStatus;
}
