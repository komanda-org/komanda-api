import type { Job, Prisma } from '@prisma/client';
import type { JobResponseDto } from './dto/job-response.dto';

// Só dados públicos do restaurante. zipCode e address alimentam o cálculo de
// distância do front; CNPJ e telefone nunca saem nas rotas de vaga.
export const PUBLIC_RESTAURANT_SELECT = {
  restaurantName: true,
  logoUrl: true,
  cuisineType: true,
  averageRating: true,
  address: true,
  zipCode: true,
} satisfies Prisma.RestaurantSelect;

// Vaga só aparece (lista, busca, detalhe) e só aceita candidatura se o dono
// existe. A exclusão de conta é soft-delete no User, então ele também entra.
export const VISIBLE_RESTAURANT_WHERE = {
  active: true,
  deletedAt: null,
  user: { active: true, deletedAt: null },
} satisfies Prisma.RestaurantWhereInput;

export type JobWithPublicRestaurant = Job & {
  restaurant: Prisma.RestaurantGetPayload<{
    select: typeof PUBLIC_RESTAURANT_SELECT;
  }>;
};

// Mesmo formato na lista (GET /jobs, /jobs/search) e no detalhe (GET /jobs/:id).
export function toJobResponse(job: JobWithPublicRestaurant): JobResponseDto {
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    requirements: job.requirements,
    salary: job.salary ? job.salary.toString() : null,
    contractType: job.contractType,
    shifts: job.shifts,
    status: job.status,
    urgent: job.urgent,
    restaurantId: job.restaurantId,
    restaurant: {
      restaurantName: job.restaurant.restaurantName,
      logoUrl: job.restaurant.logoUrl,
      cuisineType: job.restaurant.cuisineType,
      averageRating: job.restaurant.averageRating,
      address: job.restaurant.address,
      zipCode: job.restaurant.zipCode,
    },
    createdAt: job.createdAt,
  };
}
