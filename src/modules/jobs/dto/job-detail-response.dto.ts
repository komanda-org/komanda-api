import { ApiProperty } from '@nestjs/swagger';
import { CandidaturaStatus, ContractType, JobStatus } from '@prisma/client';
import type { JobResponseDto } from './job-response.dto';

export class JobDetailRestaurantDto {
  @ApiProperty()
  restaurantName!: string;

  @ApiProperty({ type: String, nullable: true })
  logoUrl!: string | null;

  @ApiProperty()
  cuisineType!: string;

  @ApiProperty({ type: Number, nullable: true })
  averageRating!: number | null;

  @ApiProperty({ description: 'Endereço comercial público' })
  address!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'null = restaurante itinerante (só eventos)',
  })
  zipCode!: string | null;
}

export class JobApplicationSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CandidaturaStatus })
  status!: CandidaturaStatus;

  @ApiProperty()
  createdAt!: Date;
}

export class JobDetailResponseDto implements JobResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ type: String, nullable: true })
  requirements!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '2200.5',
    description: 'Decimal como string, igual à lista de vagas',
  })
  salary!: string | null;

  @ApiProperty({ enum: ContractType })
  contractType!: ContractType;

  @ApiProperty({ type: String, nullable: true, example: 'NOITE' })
  shift!: string | null;

  @ApiProperty({ enum: JobStatus })
  status!: JobStatus;

  @ApiProperty()
  urgent!: boolean;

  @ApiProperty({ format: 'uuid' })
  restaurantId!: string;

  @ApiProperty({ type: JobDetailRestaurantDto })
  restaurant!: JobDetailRestaurantDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({
    description:
      'O profissional do token já se candidatou (sempre false para restaurante)',
  })
  hasApplied!: boolean;

  @ApiProperty({ type: JobApplicationSummaryDto, nullable: true })
  application!: JobApplicationSummaryDto | null;
}
