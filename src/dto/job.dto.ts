// dto/job.dto.ts
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsDate,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class JobDto {
  @IsInt()
  job_id: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsNumber()
  salary_min?: number;

  @IsOptional()
  @IsNumber()
  salary_max?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  job_type?: string;

  company_name: string;

  @IsArray()
  @IsString({ each: true })
  skills: string[];

  @IsDate()
  @Type(() => Date)
  created_at: Date;

  // --- TRƯỜNG MỚI ---
  @IsOptional() // Thêm trường mới cho logo
  @IsString()
  logo_url?: string | null;
}
