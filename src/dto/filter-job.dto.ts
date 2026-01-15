import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterJobDto {
  @IsOptional()
  @IsString()
  location?: string;

  // [REMOVED] Bỏ lọc theo lương
  // @IsOptional()
  // @IsNumber()
  // @Type(() => Number)
  // salary_min?: number;

  // @IsOptional()
  // @IsNumber()
  // @Type(() => Number)
  // salary_max?: number;

  @IsOptional()
  @IsString()
  job_type?: string; // Full-time, Part-time, Intern, Remote

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  size?: number = 20;
}