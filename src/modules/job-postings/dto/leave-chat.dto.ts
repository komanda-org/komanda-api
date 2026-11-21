import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LeaveChatDto {
  @IsString()
  @IsNotEmpty()
  jobId: string;

  /** Obrigatório para restaurante (com quem é a conversa); profissional usa o próprio id. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  professionalId?: string;
}
