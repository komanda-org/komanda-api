import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsISO8601,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListMessagesDto {
  @IsString()
  @IsNotEmpty()
  jobId: string;

  /** Obrigatório para restaurante (com quem é a conversa); profissional usa o próprio id. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  professionalId?: string;

  @IsOptional()
  @IsISO8601()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}
