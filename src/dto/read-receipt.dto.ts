// DTO để client thông báo đã đọc tin nhắn
import { IsNotEmpty, IsNumber } from 'class-validator';

export class ReadReceiptDto {
  @IsNumber()
  @IsNotEmpty()
  messageId: number;
}
