import {
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { CandidaturaStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateApplicationStatusUseCase } from './update-application-status.use-case';

type PrismaMock = {
    job: { findUnique: jest.Mock };
    candidatura: { findUnique: jest.Mock; update: jest.Mock };
};

describe('UpdateApplicationStatusUseCase', () => {
    let useCase: UpdateApplicationStatusUseCase;
    let prisma: PrismaMock;

    const RESTAURANTE_ID = 'restaurant-1';
    const VAGA_ID = 'job-1';
    const CANDIDATURA_ID = 'candidatura-1';

    beforeEach(() => {
        prisma = {
            job: { findUnique: jest.fn() },
            candidatura: { findUnique: jest.fn(), update: jest.fn() },
        };

        useCase = new UpdateApplicationStatusUseCase(
            prisma as unknown as PrismaService,
        );
    });

    it('atualiza o status quando a vaga pertence ao restaurante logado', async () => {
        prisma.job.findUnique.mockResolvedValue({
            restaurantId: RESTAURANTE_ID,
            active: true,
            deletedAt: null,
        });
        prisma.candidatura.findUnique.mockResolvedValue({
            id: CANDIDATURA_ID,
            jobId: VAGA_ID,
            status: CandidaturaStatus.PENDENTE,
        });
        prisma.candidatura.update.mockResolvedValue({
            id: CANDIDATURA_ID,
            jobId: VAGA_ID,
            status: CandidaturaStatus.APROVADA,
        });

        const result = await useCase.execute({
            vagaId: VAGA_ID,
            candidaturaId: CANDIDATURA_ID,
            restauranteId: RESTAURANTE_ID,
            novoStatus: CandidaturaStatus.APROVADA,
        });

        expect(prisma.candidatura.update).toHaveBeenCalledWith({
            where: { id: CANDIDATURA_ID },
            data: { status: CandidaturaStatus.APROVADA },
        });
        expect(result.status).toBe(CandidaturaStatus.APROVADA);
    });

    it('lança 404 quando a candidatura não existe', async () => {
        prisma.job.findUnique.mockResolvedValue({
            restaurantId: RESTAURANTE_ID,
            active: true,
            deletedAt: null,
        });
        prisma.candidatura.findUnique.mockResolvedValue(null);

        await expect(
            useCase.execute({
                vagaId: VAGA_ID,
                candidaturaId: CANDIDATURA_ID,
                restauranteId: RESTAURANTE_ID,
                novoStatus: CandidaturaStatus.APROVADA,
            }),
        ).rejects.toThrow(NotFoundException);
    });

    it('lança 403 quando a vaga pertence a outro restaurante', async () => {
        prisma.job.findUnique.mockResolvedValue({
            restaurantId: 'other-restaurant',
            active: true,
            deletedAt: null,
        });

        await expect(
            useCase.execute({
                vagaId: VAGA_ID,
                candidaturaId: CANDIDATURA_ID,
                restauranteId: RESTAURANTE_ID,
                novoStatus: CandidaturaStatus.APROVADA,
            }),
        ).rejects.toThrow(ForbiddenException);
        expect(prisma.candidatura.findUnique).not.toHaveBeenCalled();
    });

    it('impede reverter uma candidatura aprovada para pendente', async () => {
        prisma.job.findUnique.mockResolvedValue({
            restaurantId: RESTAURANTE_ID,
            active: true,
            deletedAt: null,
        });
        prisma.candidatura.findUnique.mockResolvedValue({
            id: CANDIDATURA_ID,
            jobId: VAGA_ID,
            status: CandidaturaStatus.APROVADA,
        });

        await expect(
            useCase.execute({
                vagaId: VAGA_ID,
                candidaturaId: CANDIDATURA_ID,
                restauranteId: RESTAURANTE_ID,
                novoStatus: CandidaturaStatus.PENDENTE,
            }),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.candidatura.update).not.toHaveBeenCalled();
    });
});
