import { ApiProperty } from '@nestjs/swagger';
import { Mobility, WorkModel } from '@prisma/client';

export class MyProfileExperienceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  company!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty({ example: '2019-01-01', description: 'YYYY-MM-DD' })
  startDate!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'null significa emprego atual',
  })
  endDate!: string | null;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;
}

export class MyProfileAvailabilityDto {
  @ApiProperty({ isArray: true, enum: WorkModel })
  workModels!: WorkModel[];

  @ApiProperty({
    enum: Mobility,
    nullable: true,
    description: 'null quando só os modelos de trabalho foram informados',
  })
  mobility!: Mobility | null;
}

export class MyProfileResponseDto {
  @ApiProperty({ format: 'uuid', description: 'users.id, o mesmo do JWT' })
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  mainRole!: string;

  @ApiProperty({ type: String, nullable: true })
  profilePhoto!: string | null;

  @ApiProperty({ type: String, nullable: true })
  experienceSummary!: string | null;

  @ApiProperty({ type: [String] })
  specialties!: string[];

  @ApiProperty({ type: String, nullable: true })
  neighborhood!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '01001-000',
    description:
      'Obrigatório no cadastro; null só em contas antigas, criadas antes da regra',
  })
  zipCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  city!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'UF com 2 letras',
  })
  state!: string | null;

  @ApiProperty({ type: [MyProfileExperienceDto] })
  experiences!: MyProfileExperienceDto[];

  @ApiProperty({ type: MyProfileAvailabilityDto, nullable: true })
  availability!: MyProfileAvailabilityDto | null;
}
