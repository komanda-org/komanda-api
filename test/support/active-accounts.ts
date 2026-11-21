import type { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';

interface UserLookupArgs {
  where: { id: string };
}

/**
 * O AuthGuard confere no banco se a conta do token ainda existe e está ativa.
 * Nos e2e o Prisma é mock, então esta função devolve um `user.findUnique` que
 * responde "conta ativa" para todo id assinado pelo `jwtService` do teste,
 * com o mesmo role do token. Id nunca assinado → null (conta inexistente).
 *
 * `excluded` marca ids como excluídos, para testar o 401 de conta excluída.
 */
export function activeAccountsLookup(jwtService: JwtService) {
  const roles = new Map<string, Role>();
  const excluded = new Set<string>();

  // Tipo simplificado: os testes só assinam { id, role }.
  const sign = jwtService.sign.bind(jwtService) as (
    payload: unknown,
    options?: unknown,
  ) => string;
  jest
    .spyOn(jwtService, 'sign')
    .mockImplementation((payload: unknown, options?: unknown) => {
      const { id, role } = payload as { id: string; role: Role };
      roles.set(id, role);
      return sign(payload, options);
    });

  const findUnique = jest.fn(({ where }: UserLookupArgs) => {
    const role = roles.get(where.id);
    if (!role) return Promise.resolve(null);
    return Promise.resolve({
      role,
      active: true,
      deletedAt: excluded.has(where.id) ? new Date() : null,
    });
  });

  return { findUnique, excluded };
}
