import { IsEnum, IsInt, IsOptional, Min, Max } from 'class-validator';
import { JobShift } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { normalizeShift } from './normalize-shift';

export class ListJobsQueryDto {
  @ApiProperty({
    required: false,
    enum: JobShift,
    description: 'Vagas que têm este turno entre os delas',
  })
  @IsOptional()
  @Transform(normalizeShift)
  @IsEnum(JobShift, {
    message: `shift aceita: ${Object.values(JobShift).join(', ')}`,
  })
  shift?: JobShift;

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
  @Max(50, { message: 'take deve ser menor ou igual a 50' })
  take?: number = 20;
}
