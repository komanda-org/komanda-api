import { JobStatus, PlanType } from '@prisma/client';

// Vagas ativas permitidas por plano (null = sem limite). Mesmos números da
// tela de planos do front: Gratuito 1, Profissional 5, Empresarial ilimitado.
export const MAX_ACTIVE_JOBS_BY_PLAN: Record<PlanType, number | null> = {
  [PlanType.FREE]: 1,
  [PlanType.ESSENTIAL]: 5,
  [PlanType.PRO]: null,
};

// "Ativa" = ainda não encerrada, como na aba "Ativas" do front. Pausar não
// libera vaga; só encerrar.
export const ACTIVE_JOB_STATUSES: JobStatus[] = [
  JobStatus.ABERTA,
  JobStatus.PAUSADA,
];
