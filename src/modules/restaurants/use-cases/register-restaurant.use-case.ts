import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma, Role } from '@prisma/client';
import { AuthCryptoService } from "src/auth/auth-crypto.service";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateRestaurantDto } from "../dto/create-restaurant.dto";
import { RestaurantResponseDto } from "../dto/restaurant-response.dto";

@Injectable()
export class RegisterRestaurantUseCase {

    constructor(
        private readonly prisma: PrismaService,
        private readonly auth: AuthCryptoService
    ) { }

    async execute(dto: CreateRestaurantDto): Promise<RestaurantResponseDto> {
        // Camada 1: barra o email duplicado antes de qualquer escrita
        const emailEmUso = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (emailEmUso) {
            throw new ConflictException('Email já cadastrado');
        }

        const hashedPassword = await this.auth.hash(dto.password);

        try {
            // Tudo dentro do callback grava junto ou sofre rollback junto
            const restaurant = await this.prisma.$transaction(async (tx) => {
                const user = await tx.user.create({
                    data: {
                        email: dto.email,
                        passwordHash: hashedPassword,
                        role: Role.RESTAURANTE,
                    },
                });

                return tx.restaurant.create({
                    data: {
                        userId: user.id,
                        restaurantName: dto.restaurantName,
                        cnpj: dto.cnpj,
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
                address: restaurant.address,
                phone: restaurant.phone,
                zipCode: restaurant.zipCode,
                logoUrl: restaurant.logoUrl,
                createdAt: restaurant.createdAt,
            };
        } catch (error: any) {
            throw error;
        }
    }
}
