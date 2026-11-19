import { PartialType, PickType } from '@nestjs/mapped-types';
import { Mobility, WorkModel } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  IsOptionalZipCode,
  IsZipCode,
} from 'src/common/validators/is-zip-code';
import { CreateProfessionalDto } from 'src/modules/professionals/dto/create-professional.dto';
import { CreateRestaurantDto } from 'src/modules/restaurants/dto/create-restaurant.dto';

const PROFESSIONAL_PROFILE_FIELDS = [
  'fullName',
  'profilePhoto',
  'mainRole',
  'interestedRoles',
  'experienceSummary',
  'neighborhood',
] as const;

const RESTAURANT_PROFILE_FIELDS = [
  'restaurantName',
  'cuisineType',
  'description',
  'address',
  'phone',
  'logoUrl',
] as const;

// zipCode fica fora do PartialType de propósito: o @IsOptional dele aceita
// null. O CEP do profissional é obrigatório: no PUT pode ser omitido, nunca
// apagado. O do restaurante pode ser apagado (restaurante só de eventos).
const optionalButNotNull = () =>
  ValidateIf((_object: unknown, value: unknown) => value !== undefined);

// "YYYY-MM-DD" estrito: sem hora, para a coluna DATE não sofrer fuso.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class ProfessionalExperienceInputDto {
  @IsString()
  @MinLength(1, { message: 'Empresa não pode estar vazia' })
  @MaxLength(100, { message: 'Empresa deve ter no máximo 100 caracteres' })
  company!: string;

  @IsString()
  @MinLength(1, { message: 'Cargo não pode estar vazio' })
  @MaxLength(100, { message: 'Cargo deve ter no máximo 100 caracteres' })
  role!: string;

  @Matches(DATE_ONLY, { message: 'startDate deve estar no formato YYYY-MM-DD' })
  @IsISO8601(
    { strict: true },
    { message: 'startDate deve ser uma data válida' },
  )
  startDate!: string;

  // null = emprego atual.
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'endDate deve estar no formato YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'endDate deve ser uma data válida' })
  endDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: 'Descrição da experiência deve ter no máximo 1000 caracteres',
  })
  description?: string | null;
}

export class UpdateProfessionalProfileDto extends PartialType(
  PickType(CreateProfessionalDto, PROFESSIONAL_PROFILE_FIELDS),
) {
  @optionalButNotNull()
  @IsZipCode()
  zipCode?: string;

  @IsOptional()
  @IsArray({ message: 'Especialidades deve ser uma lista' })
  @ArrayMaxSize(20, { message: 'No máximo 20 especialidades' })
  @IsString({ each: true, message: 'Cada especialidade deve ser uma string' })
  @MaxLength(50, {
    each: true,
    message: 'Cada especialidade deve ter no máximo 50 caracteres',
  })
  specialties?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Cidade deve ter no máximo 100 caracteres' })
  city?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{2}$/, { message: 'Estado deve ser a UF com 2 letras' })
  state?: string | null;

  @IsOptional()
  @IsArray({ message: 'workModels deve ser uma lista' })
  @ArrayUnique({ message: 'workModels não pode ter valores repetidos' })
  @IsEnum(WorkModel, {
    each: true,
    message: `workModels aceita: ${Object.values(WorkModel).join(', ')}`,
  })
  workModels?: WorkModel[];

  @IsOptional()
  @IsEnum(Mobility, {
    message: `mobility aceita: ${Object.values(Mobility).join(', ')}`,
  })
  mobility?: Mobility | null;

  // Substitui a lista inteira: o front manda o estado final das experiências.
  @IsOptional()
  @IsArray({ message: 'experiences deve ser uma lista' })
  @ArrayMaxSize(30, { message: 'No máximo 30 experiências' })
  @ValidateNested({ each: true })
  @Type(() => ProfessionalExperienceInputDto)
  experiences?: ProfessionalExperienceInputDto[];
}

export class UpdateRestaurantProfileDto extends PartialType(
  PickType(CreateRestaurantDto, RESTAURANT_PROFILE_FIELDS),
) {
  @IsOptionalZipCode()
  zipCode?: string | null;
}

export type UpdateProfileDto =
  | UpdateProfessionalProfileDto
  | UpdateRestaurantProfileDto;
