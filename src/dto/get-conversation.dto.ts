// src/messages/dto/get-conversation.dto.ts
import { IsInt, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class GetConversationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userA: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  userB: number;

  @Type(() => Number)
  @IsOptional()
  limit?: number = 50;

  @Type(() => Number)
  @IsOptional()
  offset?: number = 0;
}
