import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { UsersController } from './Users.controller';
import { DeleteAccountUseCase } from './use-cases/DeleteAccountUseCase';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [DeleteAccountUseCase],
})
export class UsersModule {}
