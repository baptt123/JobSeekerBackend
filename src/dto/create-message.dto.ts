// src/dto/create-message.dto.ts
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  IsUrl,
} from 'class-validator';

export class CreateMessageDto {
  @IsNumber()
  @IsNotEmpty()
  receiver_id: number;

  @IsEnum(['text', 'image'])
  @IsNotEmpty()
  message_type: 'text' | 'image';

  @IsString()
  @IsOptional() // ✅ Cho phép content null (khi gửi ảnh)
  content?: string;

  @IsUrl()
  @IsOptional() // ✅ Cho phép image_url null (khi gửi text)
  image_url?: string;
}
