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

        const emailEmUso = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (emailEmUso) {
            throw new ConflictException('Email já cadastrado');
        }

        const hashedPassword = await this.auth.hash(dto.password);

        try {
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
                        tradeName: dto.tradeName,
                        phone: dto.phone,
                        address: dto.address,
                        latitude: dto.latitude,
                        longitude: dto.longitude,
                        cnpj: dto.cnpj,
                        zipCode: dto.zipCode,
                    },
                    include: { user: true },
                });
            });

            return {
                userId: restaurant.userId,
                email: restaurant.user.email,
                role: restaurant.user.role,
                tradeName: restaurant.tradeName,
                phone: restaurant.phone,
                address: restaurant.address,
                latitude: restaurant.latitude,
                longitude: restaurant.longitude,
                cnpj: restaurant.cnpj,
                zipCode: restaurant.zipCode,
                createdAt: restaurant.createdAt,
            };
        } catch (error: any) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new ConflictException('Email já cadastrado');
            }
            throw error;
        }
    }
}
