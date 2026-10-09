import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ContractType, Job, Prisma } from '@prisma/client';
import { JobPostingResponseDto } from '../dto/job-posting-response.dto';
import { NOTIFICACAO_SERVICE } from 'src/modules/notifications/notifications.module';
import type { INotificacaoService } from 'src/modules/notifications/interfaces/notification-service.interface';

interface CreateJobPostingInput {
  title: string;
  description: string;
  requirements?: string;
  salary?: number;
  contractType: ContractType;
  restaurantId: string;
}

interface RestauranteDaVaga {
  userId: string;
  restaurantName: string;
  zipCode: string;
}

@Injectable()
export class CreateJobPostingUseCase {
  private readonly logger = new Logger(CreateJobPostingUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICACAO_SERVICE)
    private readonly notificacaoService: INotificacaoService,
  ) {}

  async execute(input: CreateJobPostingInput): Promise<JobPostingResponseDto> {
    // Camada 1: barra o restaurante inexistente antes de qualquer escrita.
    // Dá a mensagem clara e barata no caso normal (a maioria das requisições).
    const restaurante = await this.prisma.restaurant.findUnique({
      where: { userId: input.restaurantId },
      select: {
        userId: true,
        active: true,
        deletedAt: true,
        restaurantName: true,
        zipCode: true,
      },
    });

    // O token vive 7 dias, então ele sobrevive à desativação/exclusão lógica do
    // restaurante: um token ainda válido não pode publicar vaga em nome de um
    // restaurante inativo ou removido.
    if (!restaurante || !restaurante.active || restaurante.deletedAt) {
      throw new NotFoundException('Restaurante não encontrado');
    }

    let vaga: Job;
    try {
      vaga = await this.prisma.job.create({
        data: {
          title: input.title,
          description: input.description,
          requirements: input.requirements,
          salary: input.salary,
          contractType: input.contractType,
          restaurantId: input.restaurantId,
        },
      });
    } catch (error) {
      // Camada 2: rede de segurança contra corrida — o restaurante pode ter
      // sido removido entre a checagem acima e o create (violação de FK, P2003).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new NotFoundException('Restaurante não encontrado');
      }
      throw error;
    }

    // Fora do try acima: um erro na notificação nunca pode virar o 404 do P2003.
    // A vaga já está gravada; notificar é efeito colateral e não quebra o fluxo.
    await this.notificarProfissionaisCompativeis(vaga, restaurante);

    // Monta a resposta só com campos públicos — updatedAt/deletedAt/active
    // do modelo Prisma não vazam para o consumidor da API.
    return {
      id: vaga.id,
      title: vaga.title,
      description: vaga.description,
      requirements: vaga.requirements ?? undefined,
      salary: vaga.salary?.toNumber(),
      contractType: vaga.contractType,
      status: vaga.status,
      restaurantId: vaga.restaurantId,
      createdAt: vaga.createdAt,
    };
  }

  // Critério RF08 (MVP): profissional compatível = CEP com os mesmos 5 primeiros
  // dígitos do CEP do restaurante (subsetor dos Correios ≈ mesma região),
  // ativo e não excluído. Profissional sem CEP não é notificado.
  private async notificarProfissionaisCompativeis(
    vaga: Job,
    restaurante: RestauranteDaVaga,
  ): Promise<void> {
    // O CEP do restaurante é texto livre (só MaxLength): normaliza para dígitos.
    const prefixoCep = restaurante.zipCode.replace(/\D/g, '').slice(0, 5);
    if (prefixoCep.length < 5) {
      this.logger.warn(
        `Vaga ${vaga.id}: CEP do restaurante ${restaurante.userId} inválido, ninguém notificado`,
      );
      return;
    }

    try {
      // Uma única query. startsWith casa "01310-100" e "01310100": o DTO do
      // profissional garante 5 dígitos no início do CEP.
      const profissionais = await this.prisma.professional.findMany({
        where: {
          zipCode: { startsWith: prefixoCep },
          active: true,
          deletedAt: null,
          // A exclusão de conta marca só o User, então ele também é filtrado.
          user: { active: true, deletedAt: null },
          userId: { not: restaurante.userId },
        },
        select: { userId: true },
      });

      await this.notificacaoService.createMany(
        profissionais.map((p) => ({
          userId: p.userId,
          title: `Nova vaga perto de você: ${vaga.title}`,
          message: `${restaurante.restaurantName} publicou a vaga "${vaga.title}".`,
        })),
      );
    } catch (error) {
      this.logger.error(
        `Falha ao notificar profissionais da vaga ${vaga.id} (restaurante ${restaurante.userId})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
