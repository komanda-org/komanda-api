import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { JobPostingsController } from './job-postings.controller';
import { ApplyToJobPostingUseCase } from './use-cases/apply-to-job-posting.use-case';
import { CreateJobPostingUseCase } from './use-cases/create-job-posting.use-case';
import { ListJobApplicantsUseCase } from './use-cases/list-job-applicants.use-case';

// PrismaModule é @Global, então não precisa ser importado aqui.
// AuthModule sim: os guards presos no controller são instanciados no contexto
// deste módulo, e o AuthGuard depende do JwtService.
@Module({
  imports: [AuthModule],
  controllers: [JobPostingsController],
  providers: [
    CreateJobPostingUseCase,
    ApplyToJobPostingUseCase,
    ListJobApplicantsUseCase,
  ],
})
export class JobPostingsModule {}
