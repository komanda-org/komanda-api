import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateProfessionalDto } from 'src/modules/professionals/dto/create-professional.dto';
import { CreateRestaurantDto } from 'src/modules/restaurants/dto/create-restaurant.dto';

const PROFESSIONAL_PROFILE_FIELDS = [
  'fullName',
  'profilePhoto',
  'mainRole',
  'interestedRoles',
  'experienceSummary',
  'neighborhood',
  'zipCode',
] as const;

const RESTAURANT_PROFILE_FIELDS = [
  'restaurantName',
  'cuisineType',
  'description',
  'address',
  'phone',
  'zipCode',
  'logoUrl',
] as const;

export class UpdateProfessionalProfileDto extends PartialType(
  PickType(CreateProfessionalDto, PROFESSIONAL_PROFILE_FIELDS),
) {}

export class UpdateRestaurantProfileDto extends PartialType(
  PickType(CreateRestaurantDto, RESTAURANT_PROFILE_FIELDS),
) {}

export type UpdateProfileDto =
  | UpdateProfessionalProfileDto
  | UpdateRestaurantProfileDto;
