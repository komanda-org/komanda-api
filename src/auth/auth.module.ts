import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthCryptoService } from './auth-crypto.service';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';
import { JwtStrategy } from './strategy/jwt.strategy';
import { RequestPasswordRecoveryUseCase } from './use-cases/request-password-recovery.use-case';
import { ResetPasswordUseCase } from './use-cases/reset-password.use-case';
import { ConsoleMailProvider } from './providers/console-mail.provider';
import { MAIL_PROVIDER } from './interfaces/mail-provider.interface';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN') ?? '7d';

        return {
          secret: configService.getOrThrow<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: expiresIn as unknown as number,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthCryptoService,
    AuthService,
    AuthGuard,
    RolesGuard,
    JwtStrategy,
    RequestPasswordRecoveryUseCase,
    ResetPasswordUseCase,
    {
      provide: MAIL_PROVIDER,
      useClass: ConsoleMailProvider,
    },
  ],
  // JwtModule é reexportado porque o AuthGuard é preso por classe via @UseGuards
  // em outros módulos: o Nest o instancia no contexto do módulo *consumidor*,
  // então o JwtService precisa ser resolvível lá. Exportar só o AuthGuard não basta.
  exports: [AuthCryptoService, AuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
