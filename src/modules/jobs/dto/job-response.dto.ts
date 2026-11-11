import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractType, JobStatus } from '@prisma/client';

export class JobRestaurantDto {
  @ApiProperty()
  restaurantName!: string;

  @ApiPropertyOptional({ nullable: true })
  logoUrl!: string | null;

  @ApiProperty()
  zipCode!: string;

  @ApiPropertyOptional({ nullable: true, type: Number })
  averageRating!: number | null;
}

export class JobResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ nullable: true })
  requirements!: string | null;

  @ApiProperty({ nullable: true })
  salary!: string | null;

  @ApiProperty({ enum: ContractType })
  contractType!: ContractType;

  @ApiProperty({ nullable: true })
  shift!: string | null;

  @ApiProperty({ enum: JobStatus })
  status!: JobStatus;

  @ApiProperty()
  urgent!: boolean;

  @ApiProperty()
  restaurantId!: string;

  @ApiProperty({ type: JobRestaurantDto })
  restaurant!: JobRestaurantDto;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class ListJobsResponseDto {
  @ApiProperty({ type: [JobResponseDto] })
  data!: JobResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  skip!: number;

  @ApiProperty()
  take!: number;
}
