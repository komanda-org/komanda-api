import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { normalizeShift } from './normalize-shift';

export class ListJobsQueryDto {
  @ApiProperty({ required: false, example: 'NOITE' })
  @IsOptional()
  @Transform(normalizeShift)
  @IsString()
  @MaxLength(30, { message: 'shift não pode passar de 30 caracteres' })
  shift?: string;

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
