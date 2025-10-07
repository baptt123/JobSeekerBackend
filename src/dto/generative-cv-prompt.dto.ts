// src/cv/dto/generate-cv.dto.ts
import { IsString } from 'class-validator';

export class GenerateCvDto {
  @IsString()
  prompt: string;
}
