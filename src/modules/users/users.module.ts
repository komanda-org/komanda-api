import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { UsuariosController } from './users.controller';
import { UpdateMyProfileUseCase } from './use-cases/update-my-profile.use-case';
import { DeleteAccountUseCase } from './use-cases/DeleteAccountUseCase';

@Module({
  imports: [AuthModule],
  controllers: [UsuariosController],
  providers: [UpdateMyProfileUseCase, DeleteAccountUseCase],
})
export class UsersModule {}
