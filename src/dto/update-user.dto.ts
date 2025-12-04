// src/user/dto/update-user.dto.ts
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'Họ tên phải là chuỗi ký tự' })
  @MaxLength(200)
  full_name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @MaxLength(20)
  @Matches(/^[0-9]+$/, { message: 'Số điện thoại chỉ được chứa chữ số' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  // Trường này dùng khi user không upload file mới mà chỉ update text,
  // hoặc frontend gửi lại url cũ.
  @IsOptional()
  @IsString()
  avatar_url?: string;
}
