import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional, IsUrl } from 'class-validator';

export class CreateProfessionalDto {
  @IsEmail()
  @MaxLength(50,{
    message: 'Email deve ter no maximo 50 caracteres'
  })
  email!: string;

  @IsString()
  @MinLength(8, {
    message: 'Senha deve ter no mínimo 8 caracteres'
  })
  @MaxLength(64, {
    message: 'Senha deve ter no máximo 64 caracteres'
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Senha deve ter letra maiúscula, minúscula e número'
  })
  password!: string;

  @IsString()
  @MinLength(3, {
    message: 'Nome completo deve ter no mínimo 3 caracteres'
  })
  @MaxLength(100, {
    message: 'Nome completo deve ter no máximo 100 caracteres'
  })
  fullName!: string;

  @IsString()
  @MinLength(3, {
    message: 'Cargo principal é obrigatório'
  })
  @MaxLength(100, {
    message: 'Cargo principal deve ter no máximo 100 caracteres'
  })
  mainRole!: string;

  @IsOptional()
  @IsString()
  @IsUrl({}, {
    message: 'Foto de perfil deve ser uma URL válida'
  })
  profilePhoto?: string;

  @IsOptional()
  @IsString()
  @MinLength(10, {
    message: 'Resumo de experiências deve ter no mínimo 10 caracteres'
  })
  @MaxLength(1000, {
    message: 'Resumo de experiências deve ter no máximo 1000 caracteres'
  })
  experienceSummary?: string;
}