import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserChatResponseDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty({
    description:
      'Profissional da conversa. Conversa = vaga + profissional: com 2 aprovados na mesma vaga, vêm 2 conversas.',
  })
  professionalId!: string;

  @ApiProperty()
  professionalId!: string;

  @ApiProperty()
  jobTitle!: string;

  @ApiProperty()
  otherPartyName!: string;

  @ApiProperty({ nullable: true })
  otherPartyPhoto!: string | null;

  @ApiProperty({ enum: Role })
  otherPartyRole!: Role;

  @ApiProperty({ nullable: true })
  lastMessageContent!: string | null;

  @ApiProperty({ nullable: true })
  lastMessageTime!: Date | null;

  @ApiProperty()
  unreadCount!: number;
}
