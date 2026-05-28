import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma, Role } from '@prisma/client';
import { CreateProfessionalDto } from "../dto/create-professional.dto";
import { ProfessionalResponseDto } from "../dto/professional-response.dto";
import { PrismaService } from "src/prisma/prisma.service";
import { AuthCryptoService } from "src/auth/auth-crypto.service";

@Injectable()
export class RegisterProfessionalUseCase {

    constructor(
        private readonly prisma: PrismaService,
        private readonly auth: AuthCryptoService
    ){}

    async execute(dto: CreateProfessionalDto): Promise<ProfessionalResponseDto> {
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
            const professional = await this.prisma.$transaction(async (tx) => {
                const user = await tx.user.create({
                    data: {
                        email: dto.email,
                        passwordHash: hashedPassword,
                        role: Role.PROFISSIONAL,
                    },
                });

                return tx.professional.create({
                    data: {
                        userId: user.id,
                        fullName: dto.fullName,
                        profilePhoto: dto.profilePhoto,
                        mainRole: dto.mainRole,
                        interestedRoles: dto.interestedRoles,
                        neighborhood: dto.neighborhood,
                        zipCode: dto.zipCode,
                        latitude: dto.latitude,
                    },
                    include: { user: true },
                });
            });

            // Montamos a resposta só com campos públicos — passwordHash nunca sai
            return {
                id: professional.id,
                userId: professional.userId,
                email: professional.user.email,
                role: professional.user.role,
                fullName: professional.fullName,
                mainRole: professional.mainRole,
                createdAt: professional.createdAt,
            };
        } catch (error) {
            // Camada 2: rede de segurança contra condição de corrida no email
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
