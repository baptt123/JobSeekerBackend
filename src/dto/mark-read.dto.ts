import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class MarkReadDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  message_id: number;
}
