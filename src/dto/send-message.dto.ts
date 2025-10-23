// src/messages/dto/send-message.dto.ts
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SendMessageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sender_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  receiver_id: number;

  @IsString()
  @IsNotEmpty()
  content: string;
}
