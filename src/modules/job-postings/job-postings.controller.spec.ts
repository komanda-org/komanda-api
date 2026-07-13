import { Test, TestingModule } from '@nestjs/testing';
import {
  CandidaturaStatus,
  ContractType,
  JobStatus,
  Role,
} from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { JobPostingsController } from './job-postings.controller';
import { CreateJobPostingUseCase } from './use-cases/create-job-posting.use-case';
import { ApplyToJobPostingUseCase } from './use-cases/apply-to-job-posting.use-case';
import { ListJobApplicantsUseCase } from './use-cases/list-job-applicants.use-case';

describe('JobPostingsController', () => {
  let controller: JobPostingsController;
  let createJobPostingUseCase: CreateJobPostingUseCase;
  let applyToJobPostingUseCase: ApplyToJobPostingUseCase;
  let listJobApplicantsUseCase: ListJobApplicantsUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobPostingsController],
      providers: [
        {
          provide: CreateJobPostingUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: ApplyToJobPostingUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: ListJobApplicantsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get<JobPostingsController>(JobPostingsController);
    createJobPostingUseCase = module.get<CreateJobPostingUseCase>(
      CreateJobPostingUseCase,
    );
    applyToJobPostingUseCase = module.get<ApplyToJobPostingUseCase>(
      ApplyToJobPostingUseCase,
    );
    listJobApplicantsUseCase = module.get<ListJobApplicantsUseCase>(
      ListJobApplicantsUseCase,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call createJobPostingUseCase.execute with mapped payload', async () => {
    const dto = {
      titulo: 'Chef de Cozinha',
      descricao:
        'Vaga para chef com experiência em cozinha italiana e gestão de equipe.',
      requisitos: 'Experiência prévia, liderança e disponibilidade de horário.',
      salario: 4500,
      tipoContrato: ContractType.CLT,
    };

    const req = {
      user: {
        id: 'restaurant-1',
        role: Role.RESTAURANTE,
      },
    };

    const result = {
      id: 'job-1',
      titulo: dto.titulo,
      descricao: dto.descricao,
      requisitos: dto.requisitos,
      salario: dto.salario,
      tipoContrato: dto.tipoContrato,
      status: JobStatus.ABERTA,
      restauranteId: req.user.id,
      createdAt: new Date(),
    };
    // Guardamos a referência do spy: passar `createJobPostingUseCase.execute` solto para
    // o expect desprende o método do objeto (regra @typescript-eslint/unbound-method).
    const executeSpy = jest
      .spyOn(createJobPostingUseCase, 'execute')
      .mockResolvedValue(result);

    expect(await controller.create(dto, req)).toBe(result);
    expect(executeSpy).toHaveBeenCalledWith({
      titulo: dto.titulo,
      descricao: dto.descricao,
      requisitos: dto.requisitos,
      salario: dto.salario,
      tipoContrato: dto.tipoContrato,
      restauranteId: req.user.id,
    });
  });

  it('candidata o profissional do token e mapeia o ApplicationResponseDto', async () => {
    const createdAt = new Date('2026-01-01T12:00:00Z');
    const req = {
      user: { id: 'professional-1', role: Role.PROFISSIONAL },
    };

    // O Prisma devolve o campo como `professionalId` (inglês, como no schema);
    // o DTO de resposta expõe `profissionalId` para o front.
    const executeSpy = jest
      .spyOn(applyToJobPostingUseCase, 'execute')
      .mockResolvedValue({
        id: 'candidatura-1',
        jobId: 'job-1',
        professionalId: req.user.id,
        status: CandidaturaStatus.PENDENTE,
        createdAt,
        updatedAt: createdAt,
      });

    const result = await controller.apply('job-1', {}, req);

    // O id do profissional tem que sair do token, nunca do body ou da rota.
    expect(executeSpy).toHaveBeenCalledWith('job-1', 'professional-1');
    expect(result).toEqual({
      id: 'candidatura-1',
      vagaId: 'job-1',
      profissionalId: 'professional-1',
      createdAt,
    });
  });

  it('lista os candidatos usando o restaurante do token e os filtros da query', async () => {
    const req = {
      user: { id: 'restaurant-1', role: Role.RESTAURANTE },
    };

    const response = {
      data: [],
      total: 0,
      skip: 10,
      take: 5,
    };

    const executeSpy = jest
      .spyOn(listJobApplicantsUseCase, 'execute')
      .mockResolvedValue(response);

    const result = await controller.listApplicants(
      'job-1',
      { status: CandidaturaStatus.PENDENTE, skip: 10, take: 5 },
      req,
    );

    expect(executeSpy).toHaveBeenCalledWith({
      vagaId: 'job-1',
      restauranteId: 'restaurant-1',
      status: CandidaturaStatus.PENDENTE,
      skip: 10,
      take: 5,
    });
    expect(result).toBe(response);
  });
});
