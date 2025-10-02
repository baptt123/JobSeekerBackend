import {
  IsInt,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateMessageDto {
  @IsInt()
  sender_id: number;

  @IsInt()
  receiver_id: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000) // giới hạn độ dài tin nhắn để tránh spam/DoS
  content: string;
}
