import { Injectable } from "@nestjs/common";
import { CreateProfessionalDto } from "../dto/create-professional.dto";
import { PrismaService } from "src/prisma/prisma.service";
import { AuthCryptoService } from "src/auth/auth-crypto.service";
import { Role } from '@prisma/client';

@Injectable()
export class RegisterProfessionalUseCase {

    constructor(
        private readonly prisma: PrismaService,
        private readonly auth: AuthCryptoService
    ){}

    async execute(dto: CreateProfessionalDto){
        const hashedPassword = await this.auth.hash(dto.password);

        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                passwordHash: hashedPassword,
                role: Role.PROFISSIONAL
            }
        })

        try {
            await this.prisma.professional.create({
                data: {
                    userId: user.id,
                    fullName: dto.fullName,
                    profilePhoto: dto.profilePhoto,
                    mainRole: dto.mainRole,
                    interestedRoles: dto.interestedRoles,
                    neighborhood: dto.neighborhood,
                    zipCode: dto.zipCode,
                    latitude: dto.latitude
                }
            });
        } catch (error) {
            await this.prisma.user.delete({ where: { id: user.id } });
            throw error;
        }

        const { passwordHash: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
}