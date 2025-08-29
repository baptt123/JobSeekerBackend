// src/auth/auth.controller.ts
import {
  Controller,
  UseGuards,
  Request,
  Body,
  Post,
  ValidationPipe,
  UsePipes,
  HttpCode,
  Req,
  Res,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import express from 'express';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { ChangePasswordDto } from '../dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      return { statusCode: 401, message: 'Invalid credentials' };
    }
    return this.authService.login(user);
  }

  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('refresh-token')
  @HttpCode(200)
  async refreshToken(@Body() body: { userId: number; refreshToken: string }) {
    return this.authService.refreshTokens(body.userId, body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204) // no content
  logout(@Req() req: express.Request, @Res() res: express.Response) {
    // For logout just respond; token revocation can be implemented if needed
    res.sendStatus(204);
  }

  @UseGuards(JwtAuthGuard)
  @Post('forgot-password')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    return { message: 'Password reset email sent!' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('reset-password')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password has been reset!' };
  }
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
      req.user.userId,
      dto.oldPassword,
      dto.newPassword,
      dto.confirmNewPassword,
    );
    return { message: 'Đổi mật khẩu thành công' };
  }
}
