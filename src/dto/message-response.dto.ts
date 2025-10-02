import { IsBoolean, IsDateString, IsInt, IsString } from 'class-validator';

export class MessageResponseDto {
  @IsInt()
  message_id: number;

  @IsInt()
  sender_id: number;

  @IsInt()
  receiver_id: number;

  @IsString()
  content: string;

  @IsBoolean()
  is_read: boolean;

  @IsDateString()
  sent_at: string; // ISO date string
}
