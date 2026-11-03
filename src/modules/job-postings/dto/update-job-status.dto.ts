import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JobStatus } from '@prisma/client';

export class UpdateJobStatusDto {
  @ApiProperty({ enum: JobStatus })
  @IsEnum(JobStatus, {
    message: 'status deve ser ABERTA, PAUSADA ou ENCERRADA',
  })
  status!: JobStatus;
}
