import { Injectable } from "@nestjs/common";
import { Prisma, Role } from '@prisma/client';
import { AuthCryptoService } from "src/auth/auth-crypto.service";
import { PrismaService } from "src/prisma/prisma.service";
import { UserAlreadyExistsException, CnpjAlreadyExistsException } from "src/auth/exceptions";
import { CreateRestaurantDto } from "../dto/create-restaurant.dto";
import { RestaurantResponseDto } from "../dto/restaurant-response.dto";

@Injectable()
export class RegisterRestaurantUseCase {

    constructor(
        private readonly prisma: PrismaService,
        private readonly auth: AuthCryptoService
    ) { }

    async execute(dto: CreateRestaurantDto): Promise<RestaurantResponseDto> {
        const normalizedEmail = dto.email.trim().toLowerCase();
        const normalizedCnpj = dto.cnpj.replace(/\D/g, '');

        const emailEmUso = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (emailEmUso) {
            throw new UserAlreadyExistsException();
        }

        const cnpjEmUso = await this.prisma.restaurant.findUnique({
            where: { cnpj: normalizedCnpj },
        });
        if (cnpjEmUso) {
            throw new CnpjAlreadyExistsException();
        }

        const hashedPassword = await this.auth.hash(dto.password);

        try {
            const restaurant = await this.prisma.$transaction(async (tx) => {
                const user = await tx.user.create({
                    data: {
                        email: normalizedEmail,
                        passwordHash: hashedPassword,
                        role: Role.RESTAURANTE,
                    },
                });

                return tx.restaurant.create({
                    data: {
                        userId: user.id,
                        restaurantName: dto.restaurantName,
                        cnpj: normalizedCnpj,
                        cuisineType: dto.cuisineType,
                        description: dto.description,
                        address: dto.address,
                        phone: dto.phone,
                        zipCode: dto.zipCode,
                        logoUrl: dto.logoUrl,
                    },
                    include: { user: true },
                });
            });

            return {
                userId: restaurant.userId,
                email: restaurant.user.email,
                role: restaurant.user.role,
                restaurantName: restaurant.restaurantName,
                cnpj: restaurant.cnpj,
                phone: restaurant.phone,
                cuisineType: restaurant.cuisineType,
                description: restaurant.description,
                address: restaurant.address,
                zipCode: restaurant.zipCode,
                logoUrl: restaurant.logoUrl,
                createdAt: restaurant.createdAt,
            };
        } catch (error: any) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                const target = Array.isArray(error.meta?.target)
                    ? error.meta.target[0]
                    : null;
                if (target === 'cnpj') {
                    throw new CnpjAlreadyExistsException();
                }
                if (target === 'email') {
                    throw new UserAlreadyExistsException();
                }
            }

            throw error;
        }
    }
}
