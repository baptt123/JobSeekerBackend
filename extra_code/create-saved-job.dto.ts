import { IsInt } from 'class-validator';

export class CreateSavedJobDto {
  @IsInt()
  user_id: number;

  @IsInt()
  job_id: number;
}
