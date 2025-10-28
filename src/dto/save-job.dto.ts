import { IsInt, IsNotEmpty } from 'class-validator';

export class SaveJobDto {
  @IsInt()
  @IsNotEmpty()
  job_id: number;
}
