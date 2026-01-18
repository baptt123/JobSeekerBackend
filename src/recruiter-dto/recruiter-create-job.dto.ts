import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecruiterCreateJobDto {
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @IsString()
  title: string;

  @IsNotEmpty({ message: 'Mô tả không được để trống' })
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsString()
  benefits?: string;

  @IsNotEmpty({ message: 'Địa điểm không được để trống' })
  @IsString()
  location: string;

  // [UPDATED] Thêm các loại hình công việc mới vào validation
  @IsNotEmpty()
  @IsEnum(['Full-time', 'Part-time', 'Freelance', 'Contract', 'Internship'], {
    message: 'Loại công việc không hợp lệ',
  })
  job_type: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salary_min: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salary_max: number;

  @IsNotEmpty({ message: 'Hạn nộp hồ sơ không được để trống' })
  @IsDateString()
  deadline: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];
}