import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  /** Guardado só para poder fechá-lo no shutdown: o adapter não o fecha por nós. */
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    // Antes do super() só existem variáveis locais — `this` ainda não existe aqui.
    const pool = new Pool({
      connectionString: configService.getOrThrow<string>('DATABASE_URL'),
      // O Joi já converteu para number e garantiu >= 1 no boot.
      max: configService.getOrThrow<number>('DB_POOL_SIZE'),
    });

    super({ adapter: new PrismaPg(pool) });

    this.pool = pool; // a partir daqui `this` está disponível
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Banco de dados conectado');
  }

  async onModuleDestroy() {
    // Ordem importa: o Prisma primeiro devolve as conexões que estiver usando,
    // só então o pool encerra os sockets TCP.
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Banco de dados desconectado');
  }
}
