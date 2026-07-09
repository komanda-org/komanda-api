import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  // NOTE: some generated Prisma clients may not be available in the TS types
  // immediately after schema changes. Expose the model delegate used by
  // the application to avoid type errors until the client is regenerated.
  // Prefer running `npx prisma generate` to restore proper typings.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly passwordResetToken!: any;

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Banco de dados conectado');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Banco de dados desconectado');
  }
}