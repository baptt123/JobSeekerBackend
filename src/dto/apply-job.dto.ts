import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApplyJobDto {
  @IsInt()
  @IsNotEmpty()
  jobId: number;

  @IsInt()
  @IsOptional()
  cvId?: number; // Cho phép chọn CV

  @IsString()
  @IsOptional()
  coverLetter?: string; // Thư giới thiệu
}
