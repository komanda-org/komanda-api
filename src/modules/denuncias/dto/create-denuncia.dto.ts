import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DenunciaTargetType } from '@prisma/client';

export class CreateDenunciaDto {
  @IsEnum(DenunciaTargetType)
  targetType!: DenunciaTargetType;

  @IsString()
  @IsNotEmpty()
  targetId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
