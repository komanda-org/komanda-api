import { Module } from '@nestjs/common';
import { ProfessionalsController } from './Professionals.controller';
import { MyApplicationsController } from './MyApplications.controller';
import { RegisterProfessionalUseCase } from './use-cases/register-professional.use-case';
import { ListMyApplicationsUseCase } from './use-cases/list-my-applications.use-case';
import { SearchProfessionalsUseCase } from './use-cases/search-professionals.use-case';
import { GetProfessionalPublicProfileUseCase } from './use-cases/get-professional-public-profile.use-case';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ProfessionalsController, MyApplicationsController],
  providers: [
    RegisterProfessionalUseCase,
    ListMyApplicationsUseCase,
    SearchProfessionalsUseCase,
    GetProfessionalPublicProfileUseCase,
  ],
})
export class ProfessionalsModule {}
