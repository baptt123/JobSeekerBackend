// src/recruiter/dto/recruiter-create-job.dto.ts
import { IsNotEmpty, IsString, IsNumber, IsArray, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RecruiterCreateJobDto {
  @IsString({ message: 'Tiêu đề phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  title: string;

  @IsString()
  @IsNotEmpty()
  job_type: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @Type(() => Number) // Ép kiểu sang số
  @IsNumber({}, { message: 'Lương tối thiểu phải là số' })
  @Min(0)
  salary_min: number;

  @Type(() => Number) // Ép kiểu sang số
  @IsNumber({}, { message: 'Lương tối đa phải là số' })
  @Min(0)
  salary_max: number;

  // Quan trọng: Validate mảng String cho Skills
  @IsArray({ message: 'Kỹ năng phải là một danh sách' })
  @IsString({ each: true, message: 'Mỗi kỹ năng phải là chuỗi ký tự' })
  skills: string[];

  @IsDateString({}, { message: 'Deadline sai định dạng ngày tháng' })
  deadline: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  requirements: string;
}