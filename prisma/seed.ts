/**
 * Base de demonstração para a apresentação (npm run db:seed).
 *
 * 1. Apaga o lixo de testes manuais (contas e vagas listadas abaixo).
 * 2. Apaga a base de demonstração anterior (e-mails @demo.komanda.dev).
 * 3. Cria restaurantes, profissionais, vagas, candidaturas, avaliações,
 *    mensagens e notificações realistas, no sul da Bahia (os CEPs são os já
 *    validados no cálculo de distância do front).
 *
 * Pode rodar quantas vezes quiser: o resultado é sempre o mesmo. Contas que
 * não estão nas listas abaixo (a sua, as de teste *.teste@komanda.dev, as de
 * Eunápolis/Porto Seguro) não são tocadas.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CandidaturaStatus,
  ContractType,
  JobShift,
  JobStatus,
  Mobility,
  PlanType,
  Prisma,
  PrismaClient,
  Role,
  WorkModel,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

export const DEMO_PASSWORD = 'Komanda@2026';
export const DEMO_DOMAIN = '@demo.komanda.dev';

// Lixo de testes manuais que aparece no feed e no perfil público.
export const JUNK_EMAILS = [
  'asd@gmail.com',
  'caixa.alta@komanda.dev',
  'nova.conta@komanda.dev',
  'teste.exclusao@komanda.dev',
  'x1@komanda.dev',
];
export const JUNK_JOB_TITLES = [
  'asdasdasd',
  'teste teste',
  'qwdasdqwddqw',
  'Teste de CEP - Pizzaiolo',
];

const EUNAPOLIS_CEP = '45820-020';
const PORTO_SEGURO_CEP = '45810-000';

// Coordenadas fixas (aproximadas, pelo endereço) para o filtro de distância
// funcionar sem o seed depender da BrasilAPI/Nominatim.
const COORDS = {
  portoSeguroTaperapuan: { latitude: -16.4134, longitude: -39.0531 },
  eunapolisCentro: { latitude: -16.3775, longitude: -39.5803 },
  eunapolisDinahBorges: { latitude: -16.3667, longitude: -39.5728 },
};

type Tx = Prisma.TransactionClient;

const daysAgo = (days: number, hour = 10, minute = 0): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const dateOnly = (value: string): Date => new Date(`${value}T00:00:00Z`);

// CNPJ com dígitos verificadores válidos, a partir de 12 dígitos-base.
export function cnpjFromBase(base12: string): string {
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

// ---------------------------------------------------------------- limpeza

async function deleteJobs(tx: Tx, jobIds: string[]): Promise<void> {
  if (jobIds.length === 0) return;
  await tx.message.deleteMany({ where: { jobId: { in: jobIds } } });
  await tx.avaliacao.deleteMany({ where: { jobId: { in: jobIds } } });
  await tx.candidatura.deleteMany({ where: { jobId: { in: jobIds } } });
  await tx.job.deleteMany({ where: { id: { in: jobIds } } });
}

// Apaga de vez (não é soft-delete): conta, perfil e tudo que aponta para ela.
async function deleteUsers(tx: Tx, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const jobs = await tx.job.findMany({
    where: { restaurantId: { in: userIds } },
    select: { id: true },
  });
  await deleteJobs(
    tx,
    jobs.map((job) => job.id),
  );
  await tx.message.deleteMany({
    where: {
      OR: [{ senderId: { in: userIds } }, { professionalId: { in: userIds } }],
    },
  });
  await tx.avaliacao.deleteMany({
    where: {
      OR: [
        { professionalId: { in: userIds } },
        { restaurantId: { in: userIds } },
      ],
    },
  });
  await tx.candidatura.deleteMany({
    where: { professionalId: { in: userIds } },
  });
  await tx.notificacao.deleteMany({ where: { userId: { in: userIds } } });
  await tx.denuncia.deleteMany({ where: { authorId: { in: userIds } } });
  await tx.passwordResetToken.deleteMany({
    where: { userId: { in: userIds } },
  });
  // Experiências saem junto com o profissional (onDelete: Cascade).
  await tx.professional.deleteMany({ where: { userId: { in: userIds } } });
  await tx.restaurant.deleteMany({ where: { userId: { in: userIds } } });
  await tx.user.deleteMany({ where: { id: { in: userIds } } });
}

async function cleanup(tx: Tx): Promise<{ users: string[]; jobs: string[] }> {
  const users = await tx.user.findMany({
    where: {
      OR: [
        { email: { in: JUNK_EMAILS } },
        { email: { endsWith: DEMO_DOMAIN } },
      ],
    },
    select: { id: true, email: true },
  });
  const junkJobs = await tx.job.findMany({
    where: { title: { in: JUNK_JOB_TITLES } },
    select: { id: true, title: true },
  });

  await deleteJobs(
    tx,
    junkJobs.map((job) => job.id),
  );
  await deleteUsers(
    tx,
    users.map((user) => user.id),
  );

  return {
    users: users
      .map((user) => user.email)
      .filter((email) => !email.endsWith(DEMO_DOMAIN)),
    jobs: junkJobs.map((job) => job.title),
  };
}

// ---------------------------------------------------------------- dados

interface RestaurantSeed {
  key: string;
  email: string;
  restaurantName: string;
  cuisineType: string;
  description: string;
  address: string;
  phone: string;
  zipCode: string | null;
  coordinates: { latitude: number; longitude: number } | null;
  plan: PlanType;
  cnpjBase: string;
  createdDaysAgo: number;
}

const RESTAURANTS: RestaurantSeed[] = [
  {
    key: 'mare',
    email: `mare.alta${DEMO_DOMAIN}`,
    restaurantName: 'Maré Alta Frutos do Mar',
    cuisineType: 'Frutos do mar',
    description:
      'Restaurante pé na areia com frutos do mar frescos, moquecas e pratos da culinária baiana, de frente para a orla de Porto Seguro.',
    address: 'Avenida Beira Mar, 1200 - Taperapuan, Porto Seguro - BA',
    phone: '(73) 3288-1200',
    zipCode: PORTO_SEGURO_CEP,
    coordinates: COORDS.portoSeguroTaperapuan,
    plan: PlanType.PRO,
    cnpjBase: '452810000001',
    createdDaysAgo: 60,
  },
  {
    key: 'baiano',
    email: `cantinho.baiano${DEMO_DOMAIN}`,
    restaurantName: 'Cantinho Baiano',
    cuisineType: 'Comida baiana',
    description:
      'Comida caseira baiana no almoço executivo e no jantar, com acarajé, moqueca e feijoada aos sábados.',
    address: 'Rua Duque de Caxias, 345 - Centro, Eunápolis - BA',
    phone: '(73) 3281-4455',
    zipCode: EUNAPOLIS_CEP,
    coordinates: COORDS.eunapolisCentro,
    plan: PlanType.ESSENTIAL,
    cnpjBase: '452810000002',
    createdDaysAgo: 55,
  },
  {
    key: 'forno',
    email: `forno.lenha${DEMO_DOMAIN}`,
    restaurantName: 'Forno & Lenha Pizzaria',
    cuisineType: 'Pizzaria',
    description:
      'Pizzaria artesanal com massa de fermentação natural e forno a lenha, aberta de terça a domingo à noite.',
    address: 'Avenida Paulo Souto, 80 - Dinah Borges, Eunápolis - BA',
    phone: '(73) 3281-7788',
    zipCode: EUNAPOLIS_CEP,
    coordinates: COORDS.eunapolisDinahBorges,
    plan: PlanType.FREE,
    cnpjBase: '452810000003',
    createdDaysAgo: 40,
  },
  {
    key: 'buffet',
    email: `sabor.evento${DEMO_DOMAIN}`,
    restaurantName: 'Sabor de Evento Buffet',
    cuisineType: 'Buffet e eventos',
    description:
      'Buffet itinerante para casamentos, formaturas e eventos corporativos em todo o sul da Bahia. Montamos a cozinha no local do evento.',
    address: 'Atende em todo o sul da Bahia (eventos)',
    phone: '(73) 99876-5544',
    // Restaurante itinerante: sem CEP, o front não calcula distância.
    zipCode: null,
    coordinates: null,
    plan: PlanType.FREE,
    cnpjBase: '452810000004',
    createdDaysAgo: 30,
  },
];

interface ProfessionalSeed {
  key: string;
  email: string;
  fullName: string;
  mainRole: string;
  interestedRoles: string[];
  experienceSummary: string;
  neighborhood: string;
  zipCode: string;
  city: string;
  specialties: string[];
  workModels: WorkModel[];
  mobility: Mobility;
  createdDaysAgo: number;
  experiences: {
    company: string;
    role: string;
    startDate: string;
    endDate: string | null;
    description: string;
  }[];
}

const PROFESSIONALS: ProfessionalSeed[] = [
  {
    key: 'marina',
    email: `marina.souza${DEMO_DOMAIN}`,
    fullName: 'Marina Souza',
    mainRole: 'Garçonete',
    interestedRoles: ['Maître', 'Recepcionista'],
    experienceSummary:
      '6 anos de salão em restaurantes de frutos do mar e eventos. Atendimento em português e inglês para turistas.',
    neighborhood: 'Centro',
    zipCode: PORTO_SEGURO_CEP,
    city: 'Porto Seguro',
    specialties: ['Atendimento bilíngue', 'Serviço à francesa', 'Vinhos'],
    workModels: [WorkModel.CLT, WorkModel.FREELANCER],
    mobility: Mobility.REGIONAL,
    createdDaysAgo: 50,
    experiences: [
      {
        company: 'Bistrô da Orla',
        role: 'Garçonete sênior',
        startDate: '2023-01-15',
        endDate: null,
        description:
          'Responsável pela praça do salão e pelo treinamento de novos garçons.',
      },
      {
        company: 'Pousada Recanto do Mar',
        role: 'Garçonete',
        startDate: '2019-03-01',
        endDate: '2022-12-31',
        description: 'Café da manhã e jantar no restaurante da pousada.',
      },
    ],
  },
  {
    key: 'carlos',
    email: `carlos.menezes${DEMO_DOMAIN}`,
    fullName: 'Carlos Menezes',
    mainRole: 'Cozinheiro',
    interestedRoles: ['Chef de partida', 'Sous chef'],
    experienceSummary:
      '10 anos de cozinha baiana e frutos do mar. Domino moquecas, bobó e mise en place para grandes volumes.',
    neighborhood: 'Pequi',
    zipCode: EUNAPOLIS_CEP,
    city: 'Eunápolis',
    specialties: ['Moqueca baiana', 'Frutos do mar', 'Cozinha de volume'],
    workModels: [WorkModel.CLT],
    mobility: Mobility.LOCAL,
    createdDaysAgo: 48,
    experiences: [
      {
        company: 'Restaurante Sabor da Terra',
        role: 'Cozinheiro',
        startDate: '2018-05-02',
        endDate: '2025-08-30',
        description: 'Praça quente e pratos típicos no almoço executivo.',
      },
      {
        company: 'Hotel Costa Sul',
        role: 'Auxiliar de cozinha',
        startDate: '2015-02-01',
        endDate: '2018-04-30',
        description: 'Pré-preparo e apoio ao buffet do hotel.',
      },
    ],
  },
  {
    key: 'juliana',
    email: `juliana.rocha${DEMO_DOMAIN}`,
    fullName: 'Juliana Rocha',
    mainRole: 'Barista',
    interestedRoles: ['Atendente de café'],
    experienceSummary:
      'Barista com experiência em métodos filtrados e latte art, em cafeterias de alto movimento.',
    neighborhood: 'Centro',
    zipCode: PORTO_SEGURO_CEP,
    city: 'Porto Seguro',
    specialties: ['Latte art', 'Métodos filtrados'],
    workModels: [WorkModel.CLT, WorkModel.TEMPORARIO],
    mobility: Mobility.LOCAL,
    createdDaysAgo: 35,
    experiences: [
      {
        company: 'Café Passarela',
        role: 'Barista',
        startDate: '2022-06-01',
        endDate: null,
        description: 'Preparo de cafés especiais e atendimento no balcão.',
      },
    ],
  },
  {
    key: 'rafael',
    email: `rafael.oliveira${DEMO_DOMAIN}`,
    fullName: 'Rafael Oliveira',
    mainRole: 'Pizzaiolo',
    interestedRoles: ['Cozinheiro'],
    experienceSummary:
      'Pizzaiolo há 7 anos, especialista em forno a lenha e massas de longa fermentação.',
    neighborhood: 'Dinah Borges',
    zipCode: EUNAPOLIS_CEP,
    city: 'Eunápolis',
    specialties: ['Forno a lenha', 'Fermentação natural'],
    workModels: [WorkModel.CLT, WorkModel.FREELANCER],
    mobility: Mobility.REGIONAL,
    createdDaysAgo: 28,
    experiences: [
      {
        company: 'Pizzaria Bella Napoli',
        role: 'Pizzaiolo',
        startDate: '2019-09-01',
        endDate: '2025-10-15',
        description: 'Abertura de massas e operação do forno a lenha.',
      },
    ],
  },
  {
    key: 'beatriz',
    email: `beatriz.lima${DEMO_DOMAIN}`,
    fullName: 'Beatriz Lima',
    mainRole: 'Auxiliar de cozinha',
    interestedRoles: ['Cozinheira'],
    experienceSummary:
      'Auxiliar de cozinha em início de carreira. Curso de boas práticas de manipulação de alimentos concluído em 2025.',
    neighborhood: 'Juca Rosa',
    zipCode: EUNAPOLIS_CEP,
    city: 'Eunápolis',
    specialties: ['Pré-preparo', 'Boas práticas de higiene'],
    workModels: [WorkModel.CLT, WorkModel.TEMPORARIO],
    mobility: Mobility.LOCAL,
    createdDaysAgo: 20,
    experiences: [
      {
        company: 'Lanchonete Ponto Certo',
        role: 'Auxiliar de cozinha',
        startDate: '2025-03-10',
        endDate: null,
        description:
          'Pré-preparo de lanches e porções, controle de validade e limpeza da cozinha.',
      },
      {
        company: 'Buffet Festa Boa',
        role: 'Ajudante de cozinha (temporário)',
        startDate: '2024-11-01',
        endDate: '2025-01-31',
        description:
          'Apoio na montagem de pratos e na organização da cozinha em eventos de fim de ano.',
      },
    ],
  },
  {
    key: 'diego',
    email: `diego.santos${DEMO_DOMAIN}`,
    fullName: 'Diego Santos',
    mainRole: 'Bartender',
    interestedRoles: ['Garçom'],
    experienceSummary:
      'Bartender de eventos e beach clubs, com foco em drinks autorais e coquetelaria clássica.',
    neighborhood: 'Taperapuan',
    zipCode: PORTO_SEGURO_CEP,
    city: 'Porto Seguro',
    specialties: ['Coquetelaria clássica', 'Drinks autorais'],
    workModels: [WorkModel.FREELANCER],
    mobility: Mobility.NACIONAL,
    createdDaysAgo: 18,
    experiences: [
      {
        company: 'Beach Club Coroa Vermelha',
        role: 'Bartender',
        startDate: '2021-11-01',
        endDate: '2025-03-31',
        description: 'Bar de praia com alto movimento na temporada.',
      },
    ],
  },
];

interface JobSeed {
  key: string;
  restaurant: string;
  title: string;
  description: string;
  requirements: string | null;
  salary: number | null;
  contractType: ContractType;
  shifts: JobShift[];
  urgent: boolean;
  status: JobStatus;
  createdDaysAgo: number;
  closedDaysAgo?: number;
}

const JOBS: JobSeed[] = [
  {
    key: 'mare-garcom',
    restaurant: 'mare',
    title: 'Garçom/Garçonete para a temporada de verão',
    description:
      'Atendimento no salão e na varanda de frente para o mar, com público de turistas. Escala 6x1 com folga durante a semana.',
    requirements:
      'Experiência mínima de 1 ano em salão. Inglês básico é um diferencial.',
    salary: 2200,
    contractType: ContractType.CLT,
    shifts: [JobShift.TARDE, JobShift.NOITE],
    urgent: true,
    status: JobStatus.ABERTA,
    createdDaysAgo: 6,
  },
  {
    key: 'mare-cozinheiro',
    restaurant: 'mare',
    title: 'Cozinheiro(a) de frutos do mar',
    description:
      'Preparo de moquecas, peixes grelhados e porções na praça quente. Cozinha com equipe de 6 pessoas.',
    requirements: 'Experiência com frutos do mar e controle de estoque.',
    salary: 3200,
    contractType: ContractType.CLT,
    shifts: [JobShift.MANHA, JobShift.TARDE],
    urgent: false,
    status: JobStatus.ABERTA,
    createdDaysAgo: 5,
  },
  {
    key: 'mare-bartender',
    restaurant: 'mare',
    title: 'Bartender para quiosque de praia',
    description:
      'Preparo de caipirinhas, drinks autorais e sucos no quiosque do restaurante na areia.',
    requirements: 'Conhecimento de coquetelaria clássica.',
    salary: 2500,
    contractType: ContractType.FREELANCER,
    shifts: [JobShift.NOITE],
    urgent: false,
    status: JobStatus.ABERTA,
    createdDaysAgo: 2,
  },
  {
    key: 'baiano-auxiliar',
    restaurant: 'baiano',
    title: 'Auxiliar de cozinha',
    description:
      'Pré-preparo de legumes e carnes, organização da cozinha e apoio ao cozinheiro no almoço executivo.',
    requirements:
      'Não precisa de experiência. Disponibilidade de segunda a sábado.',
    salary: 1700,
    contractType: ContractType.CLT,
    shifts: [JobShift.MANHA],
    urgent: true,
    status: JobStatus.ABERTA,
    createdDaysAgo: 4,
  },
  {
    key: 'baiano-cozinheiro',
    restaurant: 'baiano',
    title: 'Cozinheiro(a) de comida baiana',
    description:
      'Responsável pela praça de pratos típicos: moqueca, bobó, vatapá e feijoada aos sábados.',
    requirements: 'Experiência de 3 anos com culinária baiana.',
    salary: 2800,
    contractType: ContractType.CLT,
    shifts: [JobShift.INTEGRAL],
    urgent: false,
    status: JobStatus.ENCERRADA,
    createdDaysAgo: 25,
    closedDaysAgo: 12,
  },
  {
    key: 'baiano-barista',
    restaurant: 'baiano',
    title: 'Barista para o café da manhã',
    description:
      'Preparo de cafés e atendimento no balcão no novo espaço de café da manhã do restaurante.',
    requirements: null,
    salary: 1900,
    contractType: ContractType.CLT,
    shifts: [JobShift.MANHA],
    urgent: false,
    status: JobStatus.ABERTA,
    createdDaysAgo: 7,
  },
  {
    key: 'forno-pizzaiolo',
    restaurant: 'forno',
    title: 'Pizzaiolo',
    description:
      'Abertura de massas de fermentação natural e operação do forno a lenha, de terça a domingo.',
    requirements: 'Experiência com forno a lenha.',
    salary: 2600,
    contractType: ContractType.CLT,
    shifts: [JobShift.NOITE],
    urgent: false,
    status: JobStatus.ABERTA,
    createdDaysAgo: 3,
  },
  {
    key: 'forno-atendente',
    restaurant: 'forno',
    title: 'Atendente de salão (fins de semana)',
    description:
      'Atendimento às mesas e delivery no balcão nas noites de sexta, sábado e domingo.',
    requirements: null,
    salary: 1200,
    contractType: ContractType.FREELANCER,
    shifts: [JobShift.NOITE],
    urgent: false,
    status: JobStatus.PAUSADA,
    createdDaysAgo: 12,
  },
  {
    key: 'buffet-garcons',
    restaurant: 'buffet',
    title: 'Garçons para casamento (sábado)',
    description:
      'Serviço volante de bebidas e canapés em casamento para 200 convidados em Trancoso. Pagamento por evento, com transporte incluso.',
    requirements: 'Traje social preto. Experiência com eventos.',
    salary: 300,
    contractType: ContractType.FREELANCER,
    shifts: [JobShift.TARDE, JobShift.NOITE],
    urgent: true,
    status: JobStatus.ABERTA,
    createdDaysAgo: 1,
  },
  {
    key: 'buffet-cozinheiro',
    restaurant: 'buffet',
    title: 'Cozinheiro(a) para eventos',
    description:
      'Montagem da cozinha no local e preparo do cardápio do evento. Pagamento por evento.',
    requirements: 'Experiência com cozinha de volume.',
    salary: 450,
    contractType: ContractType.FREELANCER,
    shifts: [JobShift.INTEGRAL],
    urgent: false,
    status: JobStatus.ABERTA,
    createdDaysAgo: 5,
  },
];

// Uma candidatura aprovada por vaga: o chat é por vaga (ver README).
const APPLICATIONS: {
  job: string;
  professional: string;
  status: CandidaturaStatus;
  daysAgo: number;
}[] = [
  {
    job: 'baiano-cozinheiro',
    professional: 'carlos',
    status: CandidaturaStatus.APROVADA,
    daysAgo: 22,
  },
  {
    job: 'baiano-cozinheiro',
    professional: 'beatriz',
    status: CandidaturaStatus.REJEITADA,
    daysAgo: 20,
  },
  {
    job: 'mare-garcom',
    professional: 'marina',
    status: CandidaturaStatus.APROVADA,
    daysAgo: 5,
  },
  {
    job: 'mare-garcom',
    professional: 'diego',
    status: CandidaturaStatus.PENDENTE,
    daysAgo: 4,
  },
  {
    job: 'mare-cozinheiro',
    professional: 'carlos',
    status: CandidaturaStatus.PENDENTE,
    daysAgo: 3,
  },
  {
    job: 'mare-bartender',
    professional: 'diego',
    status: CandidaturaStatus.PENDENTE,
    daysAgo: 1,
  },
  {
    job: 'baiano-auxiliar',
    professional: 'beatriz',
    status: CandidaturaStatus.APROVADA,
    daysAgo: 3,
  },
  {
    job: 'baiano-barista',
    professional: 'juliana',
    status: CandidaturaStatus.PENDENTE,
    daysAgo: 6,
  },
  {
    job: 'forno-pizzaiolo',
    professional: 'rafael',
    status: CandidaturaStatus.APROVADA,
    daysAgo: 2,
  },
  {
    job: 'forno-atendente',
    professional: 'juliana',
    status: CandidaturaStatus.REJEITADA,
    daysAgo: 10,
  },
  {
    job: 'buffet-garcons',
    professional: 'marina',
    status: CandidaturaStatus.PENDENTE,
    daysAgo: 1,
  },
];

const REVIEWS: {
  job: string;
  professional: string;
  author: Role;
  rating: number;
  comment: string;
  daysAgo: number;
}[] = [
  {
    job: 'baiano-cozinheiro',
    professional: 'carlos',
    author: Role.PROFISSIONAL,
    rating: 5,
    comment: 'Equipe acolhedora e pagamento sempre em dia. Recomendo.',
    daysAgo: 11,
  },
  {
    job: 'baiano-cozinheiro',
    professional: 'carlos',
    author: Role.RESTAURANTE,
    rating: 5,
    comment:
      'Cozinheiro muito organizado e moqueca impecável. Contrataríamos de novo.',
    daysAgo: 11,
  },
  {
    job: 'mare-garcom',
    professional: 'marina',
    author: Role.PROFISSIONAL,
    rating: 4,
    comment:
      'Ambiente bom e gerência atenciosa. A escala é puxada na alta temporada.',
    daysAgo: 2,
  },
  {
    job: 'mare-garcom',
    professional: 'marina',
    author: Role.RESTAURANTE,
    rating: 5,
    comment: 'Atendimento excelente com turistas estrangeiros.',
    daysAgo: 2,
  },
  {
    job: 'baiano-auxiliar',
    professional: 'beatriz',
    author: Role.RESTAURANTE,
    rating: 4,
    comment: 'Pontual e dedicada, aprendendo rápido.',
    daysAgo: 1,
  },
];

// [quem fala, texto]; R = restaurante, P = profissional.
const CHATS: {
  job: string;
  professional: string;
  daysAgo: number;
  lines: ['R' | 'P', string][];
}[] = [
  {
    job: 'mare-garcom',
    professional: 'marina',
    daysAgo: 4,
    lines: [
      [
        'R',
        'Olá, Marina! Gostamos muito do seu perfil. Pode começar na próxima segunda?',
      ],
      ['P', 'Olá! Posso sim. Qual o horário de entrada?'],
      ['R', 'Às 15h. Traga documento com foto e carteira de trabalho.'],
      ['P', 'Combinado, estarei aí. Obrigada pela oportunidade!'],
    ],
  },
  {
    job: 'baiano-auxiliar',
    professional: 'beatriz',
    daysAgo: 2,
    lines: [
      [
        'R',
        'Oi, Beatriz! Sua candidatura foi aprovada. Podemos marcar uma conversa amanhã às 9h?',
      ],
      ['P', 'Bom dia! Pode ser, sim. Preciso levar alguma coisa?'],
      ['R', 'Só o certificado do curso de boas práticas. Até amanhã!'],
    ],
  },
  {
    job: 'forno-pizzaiolo',
    professional: 'rafael',
    daysAgo: 1,
    lines: [
      [
        'R',
        'Rafael, vimos sua experiência com forno a lenha. Topa fazer um teste na quinta à noite?',
      ],
      ['P', 'Topo! A massa é de fermentação de quantas horas?'],
      ['R', '48 horas. Chegue às 17h que a gente te mostra a rotina.'],
    ],
  },
  {
    job: 'baiano-cozinheiro',
    professional: 'carlos',
    daysAgo: 21,
    lines: [
      ['R', 'Carlos, seja bem-vindo à equipe! Começamos na segunda às 7h.'],
      ['P', 'Obrigado! Estarei lá.'],
    ],
  },
];

// Mesmo texto que o CreateJobPostingUseCase gera para "vaga nova perto de você".
const NEARBY_NOTIFICATIONS: {
  job: string;
  professional: string;
  read: boolean;
}[] = [
  { job: 'mare-bartender', professional: 'diego', read: false },
  { job: 'mare-bartender', professional: 'juliana', read: false },
  { job: 'mare-cozinheiro', professional: 'marina', read: true },
  { job: 'forno-pizzaiolo', professional: 'carlos', read: false },
  { job: 'forno-pizzaiolo', professional: 'beatriz', read: true },
  { job: 'baiano-auxiliar', professional: 'rafael', read: true },
];

// ---------------------------------------------------------------- criação

async function seedDemo(tx: Tx, passwordHash: string) {
  const restaurantIds = new Map<string, string>();
  const professionalIds = new Map<string, string>();
  const jobIds = new Map<string, string>();
  const restaurantName = new Map<string, string>();

  for (const r of RESTAURANTS) {
    const user = await tx.user.create({
      data: {
        email: r.email,
        passwordHash,
        role: Role.RESTAURANTE,
        createdAt: daysAgo(r.createdDaysAgo),
        restaurant: {
          create: {
            restaurantName: r.restaurantName,
            cnpj: cnpjFromBase(r.cnpjBase),
            cuisineType: r.cuisineType,
            description: r.description,
            address: r.address,
            phone: r.phone,
            zipCode: r.zipCode,
            latitude: r.coordinates?.latitude ?? null,
            longitude: r.coordinates?.longitude ?? null,
            plan: r.plan,
            createdAt: daysAgo(r.createdDaysAgo),
          },
        },
      },
    });
    restaurantIds.set(r.key, user.id);
    restaurantName.set(r.key, r.restaurantName);
  }

  for (const p of PROFESSIONALS) {
    const user = await tx.user.create({
      data: {
        email: p.email,
        passwordHash,
        role: Role.PROFISSIONAL,
        createdAt: daysAgo(p.createdDaysAgo),
        professional: {
          create: {
            fullName: p.fullName,
            mainRole: p.mainRole,
            interestedRoles: p.interestedRoles,
            experienceSummary: p.experienceSummary,
            neighborhood: p.neighborhood,
            zipCode: p.zipCode,
            city: p.city,
            state: 'BA',
            specialties: p.specialties,
            workModels: p.workModels,
            mobility: p.mobility,
            createdAt: daysAgo(p.createdDaysAgo),
            experiences: {
              create: p.experiences.map((e) => ({
                company: e.company,
                role: e.role,
                startDate: dateOnly(e.startDate),
                endDate: e.endDate ? dateOnly(e.endDate) : null,
                description: e.description,
              })),
            },
          },
        },
      },
    });
    professionalIds.set(p.key, user.id);
  }

  const get = (map: Map<string, string>, key: string): string => {
    const id = map.get(key);
    if (!id) throw new Error(`seed: chave desconhecida "${key}"`);
    return id;
  };

  for (const j of JOBS) {
    const job = await tx.job.create({
      data: {
        title: j.title,
        description: j.description,
        requirements: j.requirements,
        salary: j.salary,
        contractType: j.contractType,
        shifts: j.shifts,
        urgent: j.urgent,
        status: j.status,
        restaurantId: get(restaurantIds, j.restaurant),
        createdAt: daysAgo(j.createdDaysAgo, 9),
        closedAt:
          j.closedDaysAgo !== undefined ? daysAgo(j.closedDaysAgo, 18) : null,
      },
    });
    jobIds.set(j.key, job.id);
  }

  await tx.candidatura.createMany({
    data: APPLICATIONS.map((a) => ({
      jobId: get(jobIds, a.job),
      professionalId: get(professionalIds, a.professional),
      status: a.status,
      createdAt: daysAgo(a.daysAgo, 11),
    })),
  });

  const restaurantOfJob = (jobKey: string): string => {
    const job = JOBS.find((j) => j.key === jobKey);
    if (!job) throw new Error(`seed: vaga desconhecida "${jobKey}"`);
    return get(restaurantIds, job.restaurant);
  };

  await tx.avaliacao.createMany({
    data: REVIEWS.map((r) => ({
      jobId: get(jobIds, r.job),
      professionalId: get(professionalIds, r.professional),
      restaurantId: restaurantOfJob(r.job),
      avaliadorRole: r.author,
      rating: r.rating,
      comment: r.comment,
      createdAt: daysAgo(r.daysAgo, 20),
    })),
  });

  await tx.message.createMany({
    data: CHATS.flatMap((chat) =>
      chat.lines.map(([who, content], index) => ({
        jobId: get(jobIds, chat.job),
        // Conversa = vaga + profissional.
        professionalId: get(professionalIds, chat.professional),
        senderId:
          who === 'R'
            ? restaurantOfJob(chat.job)
            : get(professionalIds, chat.professional),
        content,
        createdAt: daysAgo(chat.daysAgo, 14, index * 7),
      })),
    ),
  });

  await tx.notificacao.createMany({
    data: NEARBY_NOTIFICATIONS.map((n) => {
      const job = JOBS.find((j) => j.key === n.job);
      if (!job) throw new Error(`seed: vaga desconhecida "${n.job}"`);
      return {
        userId: get(professionalIds, n.professional),
        titulo: `Nova vaga perto de você: ${job.title}`,
        mensagem: `${restaurantName.get(job.restaurant)} publicou a vaga "${job.title}".`,
        lida: n.read,
        createdAt: daysAgo(job.createdDaysAgo, 9, 5),
      };
    }),
  });
}

// Nota média: restaurante só conta avaliações feitas por profissionais, e
// vice-versa. Recalcula todo mundo, porque a limpeza pode ter apagado notas.
async function recomputeAverageRatings(tx: Tx): Promise<void> {
  const restaurantAvg = await tx.avaliacao.groupBy({
    by: ['restaurantId'],
    where: { avaliadorRole: Role.PROFISSIONAL },
    _avg: { rating: true },
  });
  const professionalAvg = await tx.avaliacao.groupBy({
    by: ['professionalId'],
    where: { avaliadorRole: Role.RESTAURANTE },
    _avg: { rating: true },
  });

  await tx.restaurant.updateMany({ data: { averageRating: null } });
  await tx.professional.updateMany({ data: { averageRating: null } });
  for (const row of restaurantAvg) {
    await tx.restaurant.update({
      where: { userId: row.restaurantId },
      data: { averageRating: row._avg.rating },
    });
  }
  for (const row of professionalAvg) {
    await tx.professional.update({
      where: { userId: row.professionalId },
      data: { averageRating: row._avg.rating },
    });
  }
}

async function main(): Promise<void> {
  if (
    process.env.NODE_ENV === 'production' &&
    !process.argv.includes('--force')
  ) {
    throw new Error(
      'db:seed apaga e recria dados. Em produção, rode com --force se for mesmo isso.',
    );
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definido (.env)');

  const prisma = new PrismaClient({ adapter: new PrismaPg(url) });
  try {
    // Mesmo custo do AuthCryptoService; uma vez só, todos usam a mesma senha.
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    const removed = await prisma.$transaction(
      async (tx) => {
        const result = await cleanup(tx);
        await seedDemo(tx, passwordHash);
        await recomputeAverageRatings(tx);
        return result;
      },
      { timeout: 60_000 },
    );

    console.log('\nBase de demonstração pronta.\n');
    console.log(
      `Lixo removido: ${removed.users.length} conta(s) [${removed.users.join(', ') || '-'}]`,
    );
    console.log(
      `               ${removed.jobs.length} vaga(s) [${removed.jobs.join(', ') || '-'}]\n`,
    );
    console.log(`Senha de todas as contas de demonstração: ${DEMO_PASSWORD}\n`);
    console.table([
      ...RESTAURANTS.map((r) => ({
        tipo: 'Restaurante',
        nome: r.restaurantName,
        email: r.email,
      })),
      ...PROFESSIONALS.map((p) => ({
        tipo: 'Profissional',
        nome: `${p.fullName} (${p.mainRole})`,
        email: p.email,
      })),
    ]);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
