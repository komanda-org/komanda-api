import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import type { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { ListNotificationsUseCase } from './use-cases/list-notifications.use-case';
import { MarkAsReadUseCase } from './use-cases/mark-as-read.use-case';

@ApiTags('Notifications')
@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private readonly listNotifications: ListNotificationsUseCase,
    private readonly markAsReadUseCase: MarkAsReadUseCase,
  ) {}

  // Leitura autenticada chamada em toda tela (sino); o limite global de
  // 20/min derrubava o front com 429.
  @Get('me/notifications')
  @SkipThrottle()
  @Roles(Role.PROFISSIONAL, Role.RESTAURANTE)
  async list(
    @Query() query: ListNotificationsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listNotifications.execute({
      userId: req.user.id,
      skip: query.skip ?? 0,
      take: query.take ?? 20,
    });
  }

  @Patch('me/notifications/:id/read')
  @Roles(Role.PROFISSIONAL, Role.RESTAURANTE)
  async markAsRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.markAsReadUseCase.execute({
      id,
      userId: req.user.id,
    });
  }
}
