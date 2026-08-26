import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AuthResponseDto {
  @ApiProperty()
  access_token!: string;

  @ApiProperty({ enum: Role })
  user!: {
    id: string;
    role: Role;
  };
}
