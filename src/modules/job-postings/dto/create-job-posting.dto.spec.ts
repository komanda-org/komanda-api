import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { ContractType } from '@prisma/client';
import { CreateJobPostingDto } from './create-job-posting.dto';
import { UpdateJobPostingDto } from './update-job-posting.dto';

const MENSAGEM_URGENT = 'O campo urgente deve ser verdadeiro ou falso';

// Mesma configuração do ValidationPipe global (src/main.ts), testando só o body.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const base = {
  title: 'Chef de Cozinha',
  description: 'Vaga para chef com experiência em cozinha italiana.',
  contractType: ContractType.CLT,
};

describe('CreateJobPostingDto — contrato do campo urgent', () => {
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: CreateJobPostingDto,
    data: undefined,
  };

  it('rejeita urgent não booleano com a mensagem PT', async () => {
    const erro: unknown = await pipe
      .transform({ ...base, urgent: 'sim' }, metadata)
      .catch((e: BadRequestException) => e.getResponse());

    expect(erro).toMatchObject({ message: [MENSAGEM_URGENT] });
  });

  it('aceita body sem urgent (default do banco)', async () => {
    const out = (await pipe.transform(base, metadata)) as CreateJobPostingDto;
    expect(out.urgent).toBeUndefined();
  });

  it('trata urgent: null como não enviado (default do banco)', async () => {
    // Regressão: null chegava ao Prisma numa coluna NOT NULL (500).
    const out = (await pipe.transform(
      { ...base, urgent: null },
      metadata,
    )) as CreateJobPostingDto;
    expect(out.urgent).toBeUndefined();
  });
});

describe('UpdateJobPostingDto — herda o contrato do urgent', () => {
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: UpdateJobPostingDto,
    data: undefined,
  };

  it('trata urgent: null como não enviado também no PATCH', async () => {
    const out = (await pipe.transform(
      { urgent: null },
      metadata,
    )) as UpdateJobPostingDto;
    expect(out.urgent).toBeUndefined();
  });

  it('mantém salary: null no PATCH (permite limpar o salário)', async () => {
    const out = (await pipe.transform(
      { salary: null },
      metadata,
    )) as UpdateJobPostingDto;
    expect(out.salary).toBeNull();
  });
});
