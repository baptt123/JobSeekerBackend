// src/firebase-module/dto/send-notification.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
} from 'class-validator';

export class SendNotificationDto {
  @IsString()
  @IsNotEmpty()
  token: string; // FCM Device Token của thiết bị

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsNumber()
  @IsOptional() // Tùy chọn, dùng để lưu vào CSDL
  userId?: number;

  @IsObject()
  @IsOptional()
  data?: { [key: string]: string }; // Dữ liệu ngầm tùy chỉnh
}