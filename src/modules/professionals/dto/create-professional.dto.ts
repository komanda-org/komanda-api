import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength
} from 'class-validator';

export class CreateProfessionalDto {
  @IsEmail({}, {
    message: 'Email deve ser válido'
  })
  @MaxLength(255,{
    message: 'Email deve ter no máximo 255 caracteres'
  })
  email!: string;

  @IsString()
  @MinLength(8, {
    message: 'Senha deve ter no mínimo 8 caracteres'
  })
  @MaxLength(64, {
    message: 'Senha deve ter no máximo 64 caracteres'
  })
  password!: string;

  @IsString()
  @Matches(/\S/, {
    message: 'Nome completo não pode ser apenas espaços'
  })
  @MinLength(3, {
    message: 'Nome completo deve ter no mínimo 3 caracteres'
  })
  @MaxLength(100, {
    message: 'Nome completo deve ter no máximo 100 caracteres'
  })
  fullName!: string;

  @IsString({
    message: 'Cargo principal é obrigatório'
  })
  @MinLength(1, {
    message: 'Cargo principal não pode estar vazio'
  })
  @Matches(/\S/, {
    message: 'Cargo principal não pode ser apenas espaços'
  })
  @MaxLength(100, {
    message: 'Cargo principal deve ter no máximo 100 caracteres'
  })
  mainRole!: string;

  @IsOptional()
  @IsArray({
    message: 'Cargos de interesse deve ser uma lista'
  })
  @IsString({ each: true, message: 'Cada cargo deve ser uma string' })
  @MaxLength(50, { 
    each: true, 
    message: 'Cada cargo deve ter no máximo 50 caracteres' 
  })
  interestedRoles?: string[];

  @IsOptional()
  @IsString()
  @IsUrl({}, {
    message: 'Foto de perfil deve ser uma URL válida'
  })
  profilePhoto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: 'Bairro deve ter no máximo 100 caracteres'
  })
  neighborhood?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{5}-?\d{3}$/, {
    message: 'CEP deve estar no formato 00000-000'
  })
  zipCode?: string;
}