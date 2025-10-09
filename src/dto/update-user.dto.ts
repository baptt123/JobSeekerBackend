import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'Phải là chuỗi ký tự' })
  @MaxLength(200)
  full_name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Phải là định dạng email' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Phải là số điện thoại' })
  @MaxLength(20)
  @Matches(/^[0-9]+$/, { message: 'Số điện thoại chỉ được chứa chữ số' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Phải nhập đúng thành phố hoặc tỉnh' })
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  avatar_url?: string; // link sau khi upload
}
