/** Recorte público do perfil do profissional exposto na busca do restaurante. */
export interface ProfessionalSearchProfileDto {
  id: string;
  fullName: string;
  mainRole: string;
  interestedRoles: string[];
  profilePhoto: string | null;
  experienceSummary: string | null;
  neighborhood: string | null;
  averageRating: number | null;
}

export interface SearchProfessionalsResponseDto {
  data: ProfessionalSearchProfileDto[];
  total: number;
  skip: number;
  take: number;
}
