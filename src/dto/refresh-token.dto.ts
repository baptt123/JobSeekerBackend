// src/extra_code/refresh-token.ts
import { IsNotEmpty, IsString } from 'class-validator';
export class RefreshTokenDto {
  @IsString({ message: 'Bắt buộc phải là token' })
  @IsNotEmpty({ message: 'Token không được để trống' })
  refreshToken: string;
}
