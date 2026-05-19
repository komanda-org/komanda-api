import { IsEmail, IsString, MinLength, Matches, IsOptional, IsUrl } from 'class-validator';

export class CreateProfessionalDto {
  @IsEmail()
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: 'Email deve ser válido',
  })
  email!: string;

  @IsString()
  @MinLength(8, {
    message: 'Senha deve ter no mínimo 8 caracteres',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Senha deve ter letra maiúscula, minúscula e número',
  })
  password!: string;

  @IsString()
  @MinLength(3, {
    message: 'Nome completo deve ter no mínimo 3 caracteres',
  })
  fullName!: string;

  @IsString()
  @MinLength(3, {
    message: 'Cargo principal é obrigatório',
  })
  mainRole!: string;

  @IsOptional()
  @IsString()
  @IsUrl({}, {
    message: 'Foto de perfil deve ser uma URL válida',
  })
  profilePhoto?: string;

  @IsOptional()
  @IsString()
  @MinLength(10, {
    message: 'Resumo de experiências deve ter no mínimo 10 caracteres',
  })
  experienceSummary?: string;
}