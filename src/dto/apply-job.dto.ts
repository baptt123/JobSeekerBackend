import { IsInt, IsNotEmpty } from 'class-validator';

export class ApplyJobDto {
  @IsInt()
  @IsNotEmpty()
  jobId: number;

  // Bạn có thể thêm coverLetter ở đây nếu muốn
  // @IsString()
  // @IsOptional()
  // coverLetter?: string;
}
