import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  fullName: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
