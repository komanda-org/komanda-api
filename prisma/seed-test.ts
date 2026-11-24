/**
 * Base mínima para testar o feed com distância (npm run db:seed:test).
 *
 * 1. Apaga TODAS as vagas, junto com candidaturas, avaliações e mensagens
 *    (que dependem delas). Notas médias voltam a null.
 * 2. Recria 3 contas de teste (senha Komanda@2026):
 *    - profissional_teste@komanda.dev   (Eunápolis - BA)
 *    - restaurante_teste@komanda.dev    (Eunápolis - BA, 3 vagas)
 *    - restaurante_teste_2@komanda.dev  (São Paulo - SP, 1 vaga)
 *
 * As coordenadas dos restaurantes vêm da geocodificação real do CEP, como no
 * cadastro. Outras contas não são apagadas. Pode rodar de novo à vontade.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ContractType,
  JobShift,
  PlanType,
  PrismaClient,
  Role,
  WorkModel,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ZipCodeGeocoder } from '../src/common/geocoding/zip-code-geocoder';

// Igual à do seed.ts (importar de lá rodaria o seed de demonstração inteiro).
function cnpjFromBase(base12: string): string {
  const digit = (digits: string): number => {
    let weight = digits.length - 7;
    let sum = 0;
    for (const char of digits) {
      sum += Number(char) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = digit(base12);
  return `${base12}${first}${digit(`${base12}${first}`)}`;
}

const PASSWORD = 'Komanda@2026';
const EMAILS = {
  professional: 'profissional_teste@komanda.dev',
  restaurant: 'restaurante_teste@komanda.dev',
  restaurant2: 'restaurante_teste_2@komanda.dev',
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definido (.env)');
  const prisma = new PrismaClient({ adapter: new PrismaPg(url) });
  const geocoder = new ZipCodeGeocoder();

  try {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    const eunapolis = {
      address: 'Avenida Duque de Caxias, 500 - Centro, Eunápolis - BA',
      zipCode: '45820-020',
    };
    const saoPaulo = {
      address: 'Avenida Paulista, 1578 - Bela Vista, São Paulo - SP',
      zipCode: '01310-200',
    };
    // Fora da transação: chamada externa não segura a conexão.
    const [eunapolisCoords, saoPauloCoords] = await Promise.all([
      geocoder.geocode(eunapolis),
      geocoder.geocode(saoPaulo),
    ]);

    await prisma.$transaction(async (tx) => {
      // Tudo que aponta para vaga sem cascade, depois as vagas.
      await tx.avaliacao.deleteMany({});
      await tx.candidatura.deleteMany({});
      await tx.message.deleteMany({});
      await tx.job.deleteMany({});
      await tx.restaurant.updateMany({ data: { averageRating: null } });
      await tx.professional.updateMany({ data: { averageRating: null } });

      // Contas de teste de uma rodada anterior.
      const old = await tx.user.findMany({
        where: { email: { in: Object.values(EMAILS) } },
        select: { id: true },
      });
      const ids = old.map((u) => u.id);
      if (ids.length > 0) {
        await tx.notificacao.deleteMany({ where: { userId: { in: ids } } });
        await tx.denuncia.deleteMany({ where: { authorId: { in: ids } } });
        await tx.passwordResetToken.deleteMany({
          where: { userId: { in: ids } },
        });
        await tx.professional.deleteMany({ where: { userId: { in: ids } } });
        await tx.restaurant.deleteMany({ where: { userId: { in: ids } } });
        await tx.user.deleteMany({ where: { id: { in: ids } } });
      }

      await tx.user.create({
        data: {
          email: EMAILS.professional,
          passwordHash,
          role: Role.PROFISSIONAL,
          professional: {
            create: {
              fullName: 'Profissional Teste',
              mainRole: 'Garçom',
              interestedRoles: ['Bartender', 'Cozinheiro'],
              experienceSummary: 'Conta de teste do feed com distância.',
              neighborhood: 'Centro',
              zipCode: eunapolis.zipCode,
              city: 'Eunápolis',
              state: 'BA',
              workModels: [WorkModel.CLT, WorkModel.FREELANCER],
            },
          },
        },
      });

      const restaurant = await tx.user.create({
        data: {
          email: EMAILS.restaurant,
          passwordHash,
          role: Role.RESTAURANTE,
          restaurant: {
            create: {
              restaurantName: 'Restaurante Teste',
              cnpj: cnpjFromBase('987650000001'),
              cuisineType: 'Comida baiana',
              description: 'Restaurante de teste em Eunápolis.',
              phone: '(73) 99999-0001',
              ...eunapolis,
              latitude: eunapolisCoords?.latitude ?? null,
              longitude: eunapolisCoords?.longitude ?? null,
              // PRO para o limite de vagas por plano não atrapalhar os testes.
              plan: PlanType.PRO,
            },
          },
        },
      });

      const restaurant2 = await tx.user.create({
        data: {
          email: EMAILS.restaurant2,
          passwordHash,
          role: Role.RESTAURANTE,
          restaurant: {
            create: {
              restaurantName: 'Restaurante Teste 2',
              cnpj: cnpjFromBase('987650000002'),
              cuisineType: 'Italiana',
              description: 'Restaurante de teste em São Paulo.',
              phone: '(11) 99999-0002',
              ...saoPaulo,
              latitude: saoPauloCoords?.latitude ?? null,
              longitude: saoPauloCoords?.longitude ?? null,
              plan: PlanType.PRO,
            },
          },
        },
      });

      await tx.job.createMany({
        data: [
          {
            restaurantId: restaurant.id,
            title: 'Garçom/Garçonete',
            description:
              'Atendimento no salão no jantar, de terça a domingo. Vaga de teste em Eunápolis.',
            requirements: 'Experiência com atendimento ao público.',
            salary: 1800,
            contractType: ContractType.CLT,
            shifts: [JobShift.NOITE],
          },
          {
            restaurantId: restaurant.id,
            title: 'Cozinheiro(a)',
            description:
              'Preparo de pratos da culinária baiana no almoço. Vaga de teste em Eunápolis.',
            requirements: '1 ano de experiência em cozinha.',
            salary: 2200,
            contractType: ContractType.CLT,
            shifts: [JobShift.MANHA, JobShift.TARDE],
          },
          {
            restaurantId: restaurant.id,
            title: 'Bartender para fim de semana',
            description:
              'Drinks e atendimento no bar às sextas e sábados. Vaga de teste em Eunápolis.',
            salary: 150,
            contractType: ContractType.FREELANCER,
            shifts: [JobShift.NOITE],
            urgent: true,
          },
          {
            restaurantId: restaurant2.id,
            title: 'Barista',
            description:
              'Cafeteria na Av. Paulista. Vaga de teste longe de Eunápolis para o filtro de distância.',
            salary: 2000,
            contractType: ContractType.CLT,
            shifts: [JobShift.MANHA],
          },
        ],
      });
    });

    console.log(`Pronto. Senha de todas: ${PASSWORD}`);
    console.table([
      { conta: EMAILS.professional, cidade: 'Eunápolis - BA' },
      {
        conta: EMAILS.restaurant,
        cidade: 'Eunápolis - BA',
        coordenadas: eunapolisCoords
          ? `${eunapolisCoords.latitude}, ${eunapolisCoords.longitude}`
          : 'não geocodificou',
      },
      {
        conta: EMAILS.restaurant2,
        cidade: 'São Paulo - SP',
        coordenadas: saoPauloCoords
          ? `${saoPauloCoords.latitude}, ${saoPauloCoords.longitude}`
          : 'não geocodificou',
      },
    ]);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
