import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApplyJobDto {
  @IsInt()
  @IsNotEmpty()
  jobId: number;

  @IsInt()
  @IsOptional()
  cvId?: number; // [THÊM] Cho phép chọn CV cụ thể (nếu null sẽ lấy mặc định)

  @IsString()
  @IsOptional()
  coverLetter?: string; // [THÊM] Thư giới thiệu
}
