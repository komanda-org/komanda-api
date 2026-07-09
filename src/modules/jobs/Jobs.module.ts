import { Module } from '@nestjs/common';
import { JobsController } from './Jobs.controller';
import { ListJobsUseCase } from './use-cases/list-jobs.use-case';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [JobsController],
  providers: [ListJobsUseCase],
})
export class JobsModule {}
