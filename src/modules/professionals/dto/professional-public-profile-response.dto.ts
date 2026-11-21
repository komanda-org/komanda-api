import { ApiProperty } from '@nestjs/swagger';
import { Mobility, WorkModel } from '@prisma/client';

export class ProfessionalPublicExperienceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  company!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty({ type: String, format: 'date' })
  startDate!: Date;

  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    description: 'null = emprego atual',
  })
  endDate!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;
}

// Perfil visto por qualquer usuário logado: sem e-mail, CEP nem dados de login.
export class ProfessionalPublicProfileResponseDto {
  @ApiProperty({ format: 'uuid', description: 'users.id do profissional' })
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ type: String, nullable: true })
  profilePhoto!: string | null;

  @ApiProperty()
  mainRole!: string;

  @ApiProperty({ type: [String] })
  interestedRoles!: string[];

  @ApiProperty({ type: [String] })
  specialties!: string[];

  @ApiProperty({ type: String, nullable: true })
  experienceSummary!: string | null;

  @ApiProperty({ type: String, nullable: true })
  city!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'UF' })
  state!: string | null;

  @ApiProperty({ type: String, nullable: true })
  neighborhood!: string | null;

  @ApiProperty({ isArray: true, enum: WorkModel })
  workModels!: WorkModel[];

  @ApiProperty({ enum: Mobility, nullable: true })
  mobility!: Mobility | null;

  @ApiProperty({ type: Number, nullable: true, example: 4.6 })
  averageRating!: number | null;

  @ApiProperty({ description: 'Avaliações feitas por restaurantes' })
  reviewsCount!: number;

  @ApiProperty({ description: 'Data de cadastro' })
  memberSince!: Date;

  @ApiProperty({
    type: [ProfessionalPublicExperienceDto],
    description: 'Mais recentes primeiro (startDate desc)',
  })
  experiences!: ProfessionalPublicExperienceDto[];
}
