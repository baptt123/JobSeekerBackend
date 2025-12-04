// src/zoom/dto/create-meeting.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsInt,
  Min,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @IsNotEmpty()
  topic: string; // Ví dụ: "Phỏng vấn Frontend - Nguyễn Văn A"

  @IsOptional()
  @IsString()
  agenda?: string; // Ví dụ: "Phỏng vấn vòng 1: Technical"

  @IsDateString()
  @IsNotEmpty()
  startTime: string; // ISO 8601 string (2023-10-25T09:00:00Z)

  @IsInt()
  @Min(10)
  duration: number; // Thời lượng (phút)
}
