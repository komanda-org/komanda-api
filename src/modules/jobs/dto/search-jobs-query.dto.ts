import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ContractType } from '@prisma/client';

export class SearchJobsQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  termo?: string;

  @ApiProperty({ required: false, enum: ContractType })
  @IsOptional()
  @IsEnum(ContractType)
  tipoContrato?: ContractType;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'salarioMinimo deve ser um número com até duas casas decimais' },
  )
  @Min(0, { message: 'salarioMinimo deve ser maior ou igual a zero' })
  salarioMinimo?: number;

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
