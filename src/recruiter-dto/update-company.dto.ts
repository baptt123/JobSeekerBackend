import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateCompanyDto {
  @IsNotEmpty({ message: 'Tên công ty không được để trống' })
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  website?: string;

  // Logo URL sẽ được xử lý riêng qua upload file hoặc gửi string URL
  @IsOptional()
  @IsString()
  logo_url?: string;
}