import { IsEmail } from 'class-validator';
export class ForgotPasswordDto {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  @IsEmail({ message: 'Không đúng định dạng email' })
  email: string;
}
