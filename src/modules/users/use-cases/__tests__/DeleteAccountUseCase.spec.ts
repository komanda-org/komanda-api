import { NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DeleteAccountUseCase } from '../DeleteAccountUseCase';

const createMockPrisma = () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('DeleteAccountUseCase', () => {
  let useCase: DeleteAccountUseCase;
  let prisma: MockPrisma;

  const USER_ID = 'user-1';

  const userRow = {
    id: USER_ID,
    email: 'test@example.com',
    deletedAt: null,
    active: true,
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new DeleteAccountUseCase(prisma as unknown as PrismaService);
  });

  it('soft-deletes the account setting deletedAt and active=false', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow);
    prisma.user.update.mockResolvedValue({});

    await useCase.execute(USER_ID);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { deletedAt: expect.any(Date), active: false },
    });
  });

  it('throws NotFoundException when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(USER_ID)).rejects.toThrow(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when account is already deleted', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...userRow,
      deletedAt: new Date(),
    });

    await expect(useCase.execute(USER_ID)).rejects.toThrow(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
