import { IsInt, IsNotEmpty } from 'class-validator';

export class SavedJobDto {
  @IsInt()
  @IsNotEmpty()
  user_id: number;

  @IsInt()
  @IsNotEmpty()
  job_id: number;
}
