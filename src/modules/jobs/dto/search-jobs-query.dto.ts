import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ContractType } from '@prisma/client';
import { normalizeShift } from './normalize-shift';

export class SearchJobsQueryDto {
  @ApiProperty({
    required: false,
    example: 'garcom noite',
    description:
      'Palavras-chave separadas por espaço. A vaga precisa conter todas, em qualquer ordem, no título, descrição, requisitos ou nome do restaurante. Ignora maiúsculas e acentos.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'query não pode passar de 200 caracteres' })
  query?: string;

  @ApiProperty({ required: false, enum: ContractType })
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @ApiProperty({ required: false, example: 'NOITE' })
  @IsOptional()
  @Transform(normalizeShift)
  @IsString()
  @MaxLength(30, { message: 'shift não pode passar de 30 caracteres' })
  shift?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'minSalary deve ser um número com até duas casas decimais' },
  )
  @Min(0, { message: 'minSalary deve ser maior ou igual a zero' })
  minSalary?: number;

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
