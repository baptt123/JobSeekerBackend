import { IsString, IsOptional } from 'class-validator';

export class SearchJobDto {
  @IsString()
  query: string;

  @IsOptional()
  size?: number = 10;
}
