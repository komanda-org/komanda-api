import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  jobId: string;

  /** Obrigatório para restaurante (com quem é a conversa); profissional usa o próprio id. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  professionalId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
