// src/chat/dto/chat.dto.ts
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

// DTO để gửi tin nhắn qua WebSocket
export class SendMessageDto {
  @IsNumber()
  @IsNotEmpty()
  receiverId: number;

  @IsString()
  @IsNotEmpty()
  content: string;
}
