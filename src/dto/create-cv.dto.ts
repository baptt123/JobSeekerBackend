import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateUserCvDto {
  @IsNumber()
  user_id: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  file_url?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
  @IsOptional({ each: true })
  @IsString({ each: true })
  keywords: string[];
}
