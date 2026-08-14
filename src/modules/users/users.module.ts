import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { UsuariosController } from './users.controller';
import { UpdateMyProfileUseCase } from './use-cases/update-my-profile.use-case';

@Module({
  imports: [AuthModule],
  controllers: [UsuariosController],
  providers: [UpdateMyProfileUseCase],
})
export class UsersModule {}