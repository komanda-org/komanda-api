import type {
  Prisma,
  Professional,
  ProfessionalExperience,
} from '@prisma/client';
import type { MyProfileResponseDto } from './dto/my-profile-response.dto';
import type { ProfessionalExperienceInputDto } from './update-user.dto';

export type ProfessionalWithExperiences = Professional & {
  experiences: ProfessionalExperience[];
};

// Mais recente primeiro; é a ordem em que o perfil mostra a carreira.
export const EXPERIENCES_INCLUDE = {
  experiences: { orderBy: { startDate: 'desc' } },
} satisfies Prisma.ProfessionalInclude;

// Coluna DATE volta como meia-noite UTC; o recorte do ISO dá o dia exato.
const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const fromDateOnly = (value: string): Date => new Date(`${value}T00:00:00Z`);

export function toMyProfileResponse(
  professional: ProfessionalWithExperiences,
): MyProfileResponseDto {
  const hasAvailability =
    professional.workModels.length > 0 || professional.mobility !== null;

  return {
    id: professional.userId,
    fullName: professional.fullName,
    mainRole: professional.mainRole,
    profilePhoto: professional.profilePhoto,
    experienceSummary: professional.experienceSummary,
    specialties: professional.specialties,
    neighborhood: professional.neighborhood,
    zipCode: professional.zipCode,
    city: professional.city,
    state: professional.state,
    experiences: professional.experiences.map((experience) => ({
      id: experience.id,
      company: experience.company,
      role: experience.role,
      startDate: toDateOnly(experience.startDate),
      endDate: experience.endDate ? toDateOnly(experience.endDate) : null,
      description: experience.description,
    })),
    availability: hasAvailability
      ? {
          workModels: professional.workModels,
          mobility: professional.mobility,
        }
      : null,
  };
}

export function toExperienceCreateInput(
  experience: ProfessionalExperienceInputDto,
): Prisma.ProfessionalExperienceCreateWithoutProfessionalInput {
  return {
    company: experience.company,
    role: experience.role,
    startDate: fromDateOnly(experience.startDate),
    endDate: experience.endDate ? fromDateOnly(experience.endDate) : null,
    description: experience.description ?? null,
  };
}
