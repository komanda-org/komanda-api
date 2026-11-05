import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserChatResponseDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty()
  jobTitle!: string;

  @ApiProperty()
  otherPartyName!: string;

  @ApiProperty({ enum: Role })
  otherPartyRole!: Role;

  @ApiProperty({ nullable: true })
  lastMessageContent!: string | null;

  @ApiProperty({ nullable: true })
  lastMessageTime!: Date | null;

  @ApiProperty()
  unreadCount!: number;
}