import { ApiProperty } from '@nestjs/swagger';
import { ContractType, JobShift } from '@prisma/client';

export class RestaurantOpenJobDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: ContractType })
  contractType!: ContractType;

  @ApiProperty({ type: Number, nullable: true })
  salary!: number | null;

  @ApiProperty({
    isArray: true,
    enum: JobShift,
    example: [JobShift.NOITE],
    description: 'Lista vazia = turno não informado',
  })
  shifts!: JobShift[];

  @ApiProperty()
  urgent!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

// Perfil visto por qualquer usuário logado: sem cnpj, e-mail nem plano.
export class RestaurantPublicProfileResponseDto {
  @ApiProperty({ format: 'uuid', description: 'users.id do restaurante' })
  id!: string;

  @ApiProperty()
  restaurantName!: string;

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
    description: 'null = restaurante itinerante (só eventos)',
  })
  zipCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  logoUrl!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 4.5 })
  averageRating!: number | null;

  @ApiProperty({ description: 'Avaliações feitas por profissionais' })
  reviewsCount!: number;

  @ApiProperty({
    type: [RestaurantOpenJobDto],
    description: 'Vagas ABERTAS, mais recentes primeiro (máx. 20)',
  })
  openJobs!: RestaurantOpenJobDto[];
}
