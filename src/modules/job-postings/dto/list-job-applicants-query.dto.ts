import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CandidaturaStatus } from '@prisma/client';

export class ListJobApplicantsQueryDto {
  @ApiProperty({ enum: CandidaturaStatus, required: false })
  @IsOptional()
  @IsEnum(CandidaturaStatus, {
    message: 'status deve ser PENDENTE, APROVADA ou REJEITADA',
  })
  status?: CandidaturaStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'skip deve ser um número inteiro' })
  @Min(0, { message: 'skip deve ser maior ou igual a zero' })
  skip?: number = 0;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'take deve ser um número inteiro' })
  @Min(1, { message: 'take deve ser maior ou igual a um' })
  @Max(50, { message: 'take deve ser no máximo 50' })
  take?: number = 20;
}
