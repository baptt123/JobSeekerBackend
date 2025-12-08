import { IsNotEmpty, IsString, IsUrl, IsOptional } from 'class-validator';

export class AdminCreateCompanyDto {
  @IsNotEmpty()
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

  @IsOptional()
  @IsString()
  logo_url?: string;
}
