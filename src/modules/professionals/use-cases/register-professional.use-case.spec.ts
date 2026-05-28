import { ConflictException } from '@nestjs/common';
import { RegisterProfessionalUseCase } from './register-professional.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthCryptoService } from 'src/auth/auth-crypto.service';
import { CreateProfessionalDto } from '../dto/create-professional.dto';

describe('RegisterProfessionalUseCase', () => {
    const dto: CreateProfessionalDto = {
        email: 'teste@komanda.com',
        password: 'senha12345',
        fullName: 'Maria Silva',
        mainRole: 'Garçonete',
    };

    // Fábrica de mock: monta um PrismaService falso já com o caminho feliz pronto.
    // overrides permite trocar partes do comportamento em cada teste.
    function criarMockPrisma(overrides: Record<string, unknown> = {}): PrismaService {
        const user = {
            id: 'user-id-123',
            email: dto.email,
            passwordHash: 'hashed-password',
            role: 'PROFISSIONAL',
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            active: true,
        };

        const professional = {
            id: 'prof-id-123',
            userId: user.id,
            fullName: dto.fullName,
            mainRole: dto.mainRole,
            createdAt: new Date(),
            user,
        };

        const tx = {
            user: { create: jest.fn().mockResolvedValue(user) },
            professional: { create: jest.fn().mockResolvedValue(professional) },
        };

        const prisma = {
            user: { findUnique: jest.fn().mockResolvedValue(null) },
            // executa o callback recebido, injetando o tx falso
            $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
            ...overrides,
        };

        return prisma as unknown as PrismaService;
    }

    const mockAuth = {
        hash: jest.fn().mockResolvedValue('hashed-password'),
    } as unknown as AuthCryptoService;

    it('deve criar um profissional e retornar sem o passwordHash', async () => {
        const prisma = criarMockPrisma();
        const useCase = new RegisterProfessionalUseCase(prisma, mockAuth);

        const resultado = await useCase.execute(dto);

        expect(resultado).not.toHaveProperty('passwordHash');
        expect(resultado.email).toBe(dto.email);
        expect(resultado.role).toBe('PROFISSIONAL');
    });

    it('deve lançar ConflictException quando o email já existe', async () => {
        const prisma = criarMockPrisma({
            user: { findUnique: jest.fn().mockResolvedValue({ id: 'existente' }) },
        });
        const useCase = new RegisterProfessionalUseCase(prisma, mockAuth);

        await expect(useCase.execute(dto)).rejects.toBeInstanceOf(ConflictException);
    });
});
