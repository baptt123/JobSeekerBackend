import { IsInt, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CreateJobApplicationDto {
  @IsInt()
  jobId: number;

  @IsInt()
  userId: number;

  @IsOptional()
  @IsInt()
  cvId?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  coverLetter?: string;
}
