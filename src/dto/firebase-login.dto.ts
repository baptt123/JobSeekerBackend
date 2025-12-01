// src/auth/dto/firebase-login.dto.ts
import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FirebaseLoginDto {
  @ApiProperty({
    description: 'Token thiết bị dùng cho Push Notification (FCM)',
    required: false,
    example: 'd1_xyz_token...',
  })
  @IsString()
  @IsOptional()
  deviceToken?: string;
}
