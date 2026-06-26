import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RecoverPasswordDto } from './dto/recover-password.dto';
import { RequestPasswordRecoveryUseCase } from './use-cases/request-password-recovery.use-case';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly requestPasswordRecoveryUseCase: RequestPasswordRecoveryUseCase,
  ) { }

  @Post('login')
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return await this.authService.login(loginDto);
  }

  @Post('recuperar-senha')
  @HttpCode(200)
  async recoverPassword(@Body() dto: RecoverPasswordDto) {
    await this.requestPasswordRecoveryUseCase.execute(dto);

    return {
      message: 'Se o e-mail constar em nossa base, as instruções foram enviadas',
    };
  }
}
