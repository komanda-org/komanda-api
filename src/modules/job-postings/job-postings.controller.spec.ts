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
import { ApplyToJobPostingUseCase } from './use-cases/apply-to-job-posting.use-case';
import { CreateJobPostingUseCase } from './use-cases/create-job-posting.use-case';
import { ListJobApplicantsUseCase } from './use-cases/list-job-applicants.use-case';
import { ListUserChatsUseCase } from './use-cases/list-user-chats.use-case';
import { UpdateJobPostingUseCase } from './use-cases/update-job-posting.use-case';
import { UpdateJobStatusUseCase } from './use-cases/update-job-status.use-case';

describe('JobPostingsController', () => {
  let controller: JobPostingsController;
  let createJobPostingUseCase: CreateJobPostingUseCase;
  let applyToJobPostingUseCase: ApplyToJobPostingUseCase;
  let listJobApplicantsUseCase: ListJobApplicantsUseCase;
  let listUserChatsUseCase: ListUserChatsUseCase;
  let updateJobPostingUseCase: UpdateJobPostingUseCase;
  let updateJobStatusUseCase: UpdateJobStatusUseCase;

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
        {
          provide: ListUserChatsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: UpdateJobPostingUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: UpdateJobStatusUseCase,
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
    listUserChatsUseCase = module.get<ListUserChatsUseCase>(
      ListUserChatsUseCase,
    );
    updateJobPostingUseCase = module.get<UpdateJobPostingUseCase>(
      UpdateJobPostingUseCase,
    );
    updateJobStatusUseCase = module.get<UpdateJobStatusUseCase>(
      UpdateJobStatusUseCase,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call createJobPostingUseCase.execute with mapped payload', async () => {
    const dto = {
      title: 'Chef de Cozinha',
      description:
        'Vaga para chef com experiência em cozinha italiana e gestão de equipe.',
      requirements:
        'Experiência prévia, liderança e disponibilidade de horário.',
      salary: 4500,
      contractType: ContractType.CLT,
      urgent: true,
    };

    const req = {
      user: {
        id: 'restaurant-1',
        role: Role.RESTAURANTE,
      },
    };

    const result = {
      id: 'job-1',
      title: dto.title,
      description: dto.description,
      requirements: dto.requirements,
      salary: dto.salary,
      contractType: dto.contractType,
      status: JobStatus.ABERTA,
      urgent: true,
      restaurantId: req.user.id,
      createdAt: new Date(),
    };
    // Guardamos a referência do spy: passar `createJobPostingUseCase.execute` solto para
    // o expect desprende o método do objeto (regra @typescript-eslint/unbound-method).
    const executeSpy = jest
      .spyOn(createJobPostingUseCase, 'execute')
      .mockResolvedValue(result);

    expect(await controller.create(dto, req)).toBe(result);
    expect(executeSpy).toHaveBeenCalledWith({
      title: dto.title,
      description: dto.description,
      requirements: dto.requirements,
      salary: dto.salary,
      contractType: dto.contractType,
      urgent: true,
      restaurantId: req.user.id,
    });
  });

  it('edita a vaga usando o restaurante do token e repassa só os campos do body', async () => {
    const req = {
      user: { id: 'restaurant-1', role: Role.RESTAURANTE },
    };

    const response = {
      id: 'job-1',
      title: 'Chef de Cozinha',
      description:
        'Vaga para chef com experiência em cozinha italiana e gestão de equipe.',
      contractType: ContractType.CLT,
      status: JobStatus.ABERTA,
      urgent: true,
      restaurantId: 'restaurant-1',
      createdAt: new Date(),
    };

    const executeSpy = jest
      .spyOn(updateJobPostingUseCase, 'execute')
      .mockResolvedValue(response);

    const result = await controller.update('job-1', { urgent: true }, req);

    expect(executeSpy).toHaveBeenCalledWith({
      jobId: 'job-1',
      restaurantId: 'restaurant-1',
      changes: expect.objectContaining({ urgent: true }) as unknown,
    });
    expect(result).toBe(response);
  });

  it('muda o status da vaga usando o restaurante do token', async () => {
    const req = {
      user: { id: 'restaurant-1', role: Role.RESTAURANTE },
    };

    const response = {
      id: 'job-1',
      title: 'Chef de Cozinha',
      description:
        'Vaga para chef com experiência em cozinha italiana e gestão de equipe.',
      contractType: ContractType.CLT,
      status: JobStatus.PAUSADA,
      urgent: false,
      restaurantId: 'restaurant-1',
      createdAt: new Date(),
    };

    const executeSpy = jest
      .spyOn(updateJobStatusUseCase, 'execute')
      .mockResolvedValue(response);

    const result = await controller.updateStatus(
      'job-1',
      { status: JobStatus.PAUSADA },
      req,
    );

    expect(executeSpy).toHaveBeenCalledWith({
      jobId: 'job-1',
      restaurantId: 'restaurant-1',
      status: JobStatus.PAUSADA,
    });
    expect(result).toBe(response);
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
      jobId: 'job-1',
      professionalId: 'professional-1',
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
      jobId: 'job-1',
      restaurantId: 'restaurant-1',
      status: CandidaturaStatus.PENDENTE,
      skip: 10,
      take: 5,
    });
    expect(result).toBe(response);
  });

  it('lista as conversas do usuário logado', async () => {
    const req = {
      user: { id: 'professional-1', role: Role.PROFISSIONAL },
    };

    const response = [
      {
        jobId: 'job-1',
        jobTitle: 'Chef de Cozinha',
        otherPartyName: 'Restaurante Teste',
        otherPartyRole: Role.RESTAURANTE,
        lastMessageContent: 'Olá!',
        lastMessageTime: new Date('2024-01-15T10:00:00Z'),
        unreadCount: 0,
      },
    ];

    const executeSpy = jest
      .spyOn(listUserChatsUseCase, 'execute')
      .mockResolvedValue(response as any);

    const result = await controller.listMyChats(req);

    expect(executeSpy).toHaveBeenCalledWith({
      userId: 'professional-1',
      userRole: Role.PROFISSIONAL,
    });
    expect(result).toBe(response);
  });
});
