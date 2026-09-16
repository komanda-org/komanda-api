import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { ReviewsController } from './Reviews.controller';
import { CreateReviewUseCase } from './use-cases/create-review.use-case';
import { ListReceivedReviewsUseCase } from './use-cases/list-received-reviews.use-case';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let listReceivedReviewsUseCase: ListReceivedReviewsUseCase;
  let createReviewUseCase: CreateReviewUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ListReceivedReviewsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: CreateReviewUseCase,
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

    controller = module.get<ReviewsController>(ReviewsController);
    listReceivedReviewsUseCase = module.get<ListReceivedReviewsUseCase>(
      ListReceivedReviewsUseCase,
    );
    createReviewUseCase = module.get<CreateReviewUseCase>(CreateReviewUseCase);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('lista as avaliações recebidas usando o id da rota e os filtros da query', async () => {
    const response = {
      data: [],
      total: 0,
      skip: 10,
      take: 5,
      averageRating: null,
    };

    const executeSpy = jest
      .spyOn(listReceivedReviewsUseCase, 'execute')
      .mockResolvedValue(response);

    const result = await controller.listReceivedReviews('user-1', {
      skip: 10,
      take: 5,
    });

    expect(executeSpy).toHaveBeenCalledWith({
      userId: 'user-1',
      skip: 10,
      take: 5,
    });
    expect(result).toBe(response);
  });

  it('usa skip/take padrão quando a query não informa', async () => {
    const response = {
      data: [],
      total: 0,
      skip: 0,
      take: 20,
      averageRating: null,
    };

    const executeSpy = jest
      .spyOn(listReceivedReviewsUseCase, 'execute')
      .mockResolvedValue(response);

    const result = await controller.listReceivedReviews('user-2', {});

    expect(executeSpy).toHaveBeenCalledWith({
      userId: 'user-2',
      skip: undefined,
      take: undefined,
    });
    expect(result).toBe(response);
  });

  it('cria avaliação usando o id do usuário autenticado do token', async () => {
    const payload = {
      id: 'user-profissional',
      role: Role.PROFISSIONAL,
    };
    const dto = {
      jobId: 'job-1',
      receiverId: 'user-restaurante',
      rating: 5,
      comment: 'Excelente trabalho',
    };
    const response = {
      id: 'avaliacao-1',
      jobId: dto.jobId,
      professionalId: payload.id,
      restaurantId: dto.receiverId,
      rating: dto.rating,
      comment: dto.comment,
      avaliadorRole: Role.PROFISSIONAL,
      createdAt: new Date('2026-08-30T12:00:00Z'),
      updatedAt: new Date('2026-08-30T12:00:00Z'),
    } as any;

    const executeSpy = jest
      .spyOn(createReviewUseCase, 'execute')
      .mockResolvedValue(response);

    const result = await controller.createReview(dto, {
      user: payload,
    });

    expect(executeSpy).toHaveBeenCalledWith({
      authorId: payload.id,
      jobId: dto.jobId,
      receiverId: dto.receiverId,
      rating: dto.rating,
      comment: dto.comment,
    });
    expect(result).toBe(response);
  });

  it('cria avaliação sem comentário quando ele não é informado', async () => {
    const payload = { id: 'user-profissional', role: Role.PROFISSIONAL };
    const dto = {
      jobId: 'job-1',
      receiverId: 'user-restaurante',
      rating: 4,
    };

    const executeSpy = jest
      .spyOn(createReviewUseCase, 'execute')
      .mockResolvedValue({ id: 'avaliacao-2' } as any);

    await controller.createReview(dto, { user: payload });

    expect(executeSpy).toHaveBeenCalledWith({
      authorId: payload.id,
      jobId: dto.jobId,
      receiverId: dto.receiverId,
      rating: dto.rating,
      comment: undefined,
    });
  });

  it('propaga o erro lançado pelo use case ao criar avaliação', async () => {
    const payload = { id: 'user-profissional', role: Role.PROFISSIONAL };
    const dto = {
      jobId: 'job-1',
      receiverId: 'user-restaurante',
      rating: 3,
    };

    jest
      .spyOn(createReviewUseCase, 'execute')
      .mockRejectedValue(new ForbiddenException('não permitido'));

    await expect(
      controller.createReview(dto as any, { user: payload } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
