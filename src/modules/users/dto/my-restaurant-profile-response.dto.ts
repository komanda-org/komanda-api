import { ApiProperty } from '@nestjs/swagger';
import { PlanType, Role } from '@prisma/client';
import { MyProfileResponseDto } from './my-profile-response.dto';

// O GET /users/me atende os dois roles; `role` diz ao front qual formato chegou.
export class MyProfessionalMeResponseDto extends MyProfileResponseDto {
  @ApiProperty({ enum: [Role.PROFISSIONAL], example: Role.PROFISSIONAL })
  role!: typeof Role.PROFISSIONAL;
}

export class MyRestaurantMeResponseDto {
  @ApiProperty({ enum: [Role.RESTAURANTE], example: Role.RESTAURANTE })
  role!: typeof Role.RESTAURANTE;

  @ApiProperty({ format: 'uuid', description: 'users.id, o mesmo do JWT' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  restaurantName!: string;

  @ApiProperty({
    example: '12.345.678/0001-95',
    description: 'Só aparece para o dono; a rota pública não expõe',
  })
  cnpj!: string;

  @ApiProperty()
  cuisineType!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '45820-020',
    description: 'null = restaurante itinerante (só eventos)',
  })
  zipCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  logoUrl!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 4.5 })
  averageRating!: number | null;

  @ApiProperty({ enum: PlanType })
  plan!: PlanType;
}

export type MeResponseDto =
  | MyProfessionalMeResponseDto
  | MyRestaurantMeResponseDto;
