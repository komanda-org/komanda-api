import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { UsersController } from './users.controller';
import { GetMyProfileUseCase } from './use-cases/get-my-profile.use-case';
import { UpdateMyProfileUseCase } from './use-cases/update-my-profile.use-case';
import { DeleteAccountUseCase } from './use-cases/DeleteAccountUseCase';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [
    GetMyProfileUseCase,
    UpdateMyProfileUseCase,
    DeleteAccountUseCase,
  ],
})
export class UsersModule {}
