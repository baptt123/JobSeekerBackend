// src/firebase-module/dto/send-notification.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  IsEnum, // ✅ Thêm
} from 'class-validator';
import { NotificationType } from '../entity/notification.entity';

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

  @IsEnum(NotificationType) // ✅ Thêm loại thông báo
  @IsOptional()
  type?: NotificationType = NotificationType.SYSTEM; // Default là SYSTEM

  @IsNumber()
  @IsOptional() // Tùy chọn, dùng để lưu vào CSDL
  userId?: number;

  @IsObject()
  @IsOptional()
  data?: Record<string, any>; // Dữ liệu ngầm tùy chỉnh
}
