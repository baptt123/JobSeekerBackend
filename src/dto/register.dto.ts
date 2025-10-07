import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'Yêu cầu phải có họ tên đầy đủ' })
  full_name: string;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  @IsEmail({ message: 'Không đúng định dạng email' })
  email: string;

  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 kí tự' })
  password: string;
}
