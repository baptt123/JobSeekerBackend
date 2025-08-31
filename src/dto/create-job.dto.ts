// create-job.dto.ts
import {
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateJobDto {
  @IsNumber()
  company_id: number;

  @IsNumber()
  posted_by: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  requirements?: string;

  @IsNumber()
  @IsOptional()
  salary_min?: number;

  @IsNumber()
  @IsOptional()
  salary_max?: number;

  @IsString()
  @IsOptional()
  location?: string;

  @IsEnum(['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance'])
  job_type: 'Full-time' | 'Part-time' | 'Internship' | 'Contract' | 'Freelance';
}
