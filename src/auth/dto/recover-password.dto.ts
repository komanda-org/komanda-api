import { IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';

export class RecoverPasswordDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEmail()
  email!: string;
}
