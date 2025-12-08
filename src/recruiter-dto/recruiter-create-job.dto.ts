import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
} from 'class-validator';

export class RecruiterCreateJobDto {
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
  @IsEnum(['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance'])
  job_type?:
    | 'Full-time'
    | 'Part-time'
    | 'Internship'
    | 'Contract'
    | 'Freelance';

  @IsArray()
  @IsString({ each: true })
  skills: string[]; // List tên skill: ["Java", "NestJS"]

  @IsOptional()
  @IsString()
  deadline?: string; // ISO Date string
}
