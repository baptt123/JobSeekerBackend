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
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { Roles } from '../decorator/role.decorator';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import * as admin from 'firebase-admin';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { OrAuthGuard } from '../guard/or-auth.guard';
import { FirebaseLoginDto } from '../dto/firebase-login.dto'; // 👈 Thêm admin
// [THÊM MỚI] Định nghĩa kiểu cho `req.user` sau khi Guard chạy
interface RequestWithFirebaseUser extends Request {
  user: admin.auth.DecodedIdToken;
}
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async signup(@Body() dto: RegisterDto) {
    console.log('DTO:', dto);
    console.log('Body:', JSON.stringify(dto));
    return await this.authService.register(dto);
  }

  @Put('update-password')
  @UseGuards(OrAuthGuard)
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
  async forgotPassword(@Body() forgotPasswordDTO: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDTO.email);
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
  @UseGuards(OrAuthGuard) // ✨ Bảo vệ route này
  getProfile(@Req() user: any): any {
    // Nhờ @GetUser, chúng ta có thể truy cập thẳng vào thông tin người dùng
    // đã được xác thực từ token.
    console.log(user);
    return {
      message: `Hello, this is a protected route!`,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      userId: user.uid,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      email: user.email,
    };
  }

  /**
   * Endpoint cho Flutter gọi để đăng nhập bằng Google
   * Header: Authorization: Bearer <FirebaseIdToken>
   * Body: { "deviceToken": "..." }
   */
  @Post('firebase-login')
  @UseGuards(OrAuthGuard) // Guard này check Header để lấy req.user
  async googleLogin(
    @Req() req: RequestWithFirebaseUser,
    @Body() body: FirebaseLoginDto, // [THÊM MỚI] Nhận body
  ): Promise<AuthResponseDto> {
    // Truyền cả user payload và deviceToken vào service
    return this.authService.loginWithGoogle(req.user, body.deviceToken);
  }
}
