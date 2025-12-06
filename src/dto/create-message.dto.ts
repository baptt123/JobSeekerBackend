// src/dto/create-message.dto.ts
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class CreateMessageDto {
  @IsNumber()
  @IsNotEmpty()
  receiver_id: number;

  @IsEnum(['text', 'image', 'file', 'sticker']) // ✅ Cập nhật enum
  @IsNotEmpty()
  message_type: 'text' | 'image' | 'file' | 'sticker';

  @IsString()
  @IsOptional()
  content?: string; // Nếu là file, content sẽ là Tên file

  @IsString()
  @IsOptional()
  image_url?: string; // URL của ảnh/file/sticker
}
