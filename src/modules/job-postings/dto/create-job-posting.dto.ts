import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ContractType } from '@prisma/client';

export class CreateJobPostingDto {
  @ApiProperty()
  @IsString()
  @MinLength(5, {
    message: 'O titulo deve ter ao menos 5 caracteres',
  })
  @MaxLength(100, {
    message: 'O titulo não pode passar de 100 caracteres',
  })
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(20, {
    message: 'A descrição deve ter ao menos 20 caracteres',
  })
  @MaxLength(2000, {
    message: 'A descrição não pode passar de 2000 caracteres',
  })
  description!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: 'O requisito não pode passar de 1000 caracteres',
  })
  requirements?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0, {
    message: 'O salário não pode ser negativo',
  })
  salary?: number;

  @ApiProperty({ enum: ContractType })
  @IsEnum(ContractType)
  contractType!: ContractType;

  // Opcional no body: se ausente, o banco aplica o @default(false) do schema.
  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean({
    message: 'O campo urgente deve ser verdadeiro ou falso',
  })
  urgent?: boolean;
}
