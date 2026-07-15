import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ContractType } from '@prisma/client';

export class CreateJobPostingDto {
  @IsString()
  @MinLength(5, {
    message: 'O titulo deve ter ao menos 5 caracteres',
  })
  @MaxLength(100, {
    message: 'O titulo não pode passar de 100 caracteres',
  })
  titulo!: string;

  @IsString()
  @MinLength(20, {
    message: 'A descrição deve ter ao menos 20 caracteres',
  })
  @MaxLength(2000, {
    message: 'A descrição não pode passar de 2000 caracteres',
  })
  descricao!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: 'O requisito não pode passar de 1000 caracteres',
  })
  requisitos?: string;

  @IsOptional()
  @IsNumber()
  @Min(0, {
    message: 'O salário não pode ser negativo',
  })
  salario?: number;

  @IsEnum(ContractType)
  tipoContrato!: ContractType;
}
