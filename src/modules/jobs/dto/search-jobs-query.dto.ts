import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ContractType, JobShift } from '@prisma/client';
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
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'minSalary deve ser um número com até duas casas decimais' },
  )
  @Min(0, { message: 'minSalary deve ser maior ou igual a zero' })
  minSalary?: number;

  @ApiProperty({
    required: false,
    example: -12.97,
    description: 'Latitude do profissional. Vai junto com lng.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'lat deve ser um número' })
  @Min(-90, { message: 'lat deve estar entre -90 e 90' })
  @Max(90, { message: 'lat deve estar entre -90 e 90' })
  lat?: number;

  @ApiProperty({
    required: false,
    example: -38.5,
    description: 'Longitude do profissional. Vai junto com lat.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'lng deve ser um número' })
  @Min(-180, { message: 'lng deve estar entre -180 e 180' })
  @Max(180, { message: 'lng deve estar entre -180 e 180' })
  lng?: number;

  @ApiProperty({
    required: false,
    example: 5,
    description:
      'Raio em km a partir de lat/lng. Exige lat e lng. Ausente = sem limite.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'maxDistanceKm deve ser um número' })
  @IsPositive({ message: 'maxDistanceKm deve ser maior que zero' })
  maxDistanceKm?: number;

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
