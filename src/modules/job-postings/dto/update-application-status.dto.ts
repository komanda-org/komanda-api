import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CandidaturaStatus } from '@prisma/client';

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: CandidaturaStatus, required: false })
  @IsEnum(CandidaturaStatus, {
    message: 'status deve ser PENDENTE, APROVADA ou REJEITADA',
  })
  status: CandidaturaStatus;
}
