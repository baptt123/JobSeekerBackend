// src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from '../dto/register.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { RolesGuard } from '../guard/role-auth.guard';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { Roles } from '../decorator/role.decorator';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { FirebaseAuthGuard } from '../guard/firebase-auth.guard';
import { GetUser } from '../decorator/get-user.decorator';
import * as auth from 'firebase-admin/auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async signup(@Body() dto: RegisterDto) {
    console.log('DTO:', dto);
    console.log('Body:', JSON.stringify(dto));
    return await this.authService.createUser(dto);
  }

  @Put('update-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async updatePassword(
    @Req() req: any,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: ChangePasswordDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.log('>>> user payload:', req.user);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
    return this.authService.updatePassword(req.user.userId, dto);
  }

  @Put('forgot-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async forgotPassword(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
    return this.authService.forgotPassword(req.user.email);
  }

  @Post('login')
  async login(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: LoginDto,
  ) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  async refresh(@Body() refreshToken: RefreshTokenDto) {
    return this.authService.refreshToken(refreshToken);
  }

  @Get('profile')
  @UseGuards(FirebaseAuthGuard) // ✨ Bảo vệ route này
  getProfile(@GetUser() user: auth.DecodedIdToken): any {
    // Nhờ @GetUser, chúng ta có thể truy cập thẳng vào thông tin người dùng
    // đã được xác thực từ token.
    console.log(user);
    return {
      message: `Hello, this is a protected route!`,
      userId: user.uid,
      email: user.email,
    };
  }
}
