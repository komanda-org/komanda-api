import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';

export class RecoverPasswordDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEmail()
  email!: string;
}
