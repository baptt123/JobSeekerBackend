import { Controller, Get, Post, Body, Res, Render } from '@nestjs/common';
import { AuthService } from './auth.service';
import express, { Response } from 'express';
import { LoginDto } from '../dto/login.dto';

@Controller('web')
export class WebAuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  @Render('auth/login')
  getLoginPage() {
    return { layout: false }; // Không dùng layout mặc định
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res() res: express.Response) {
    try {
      const result = await this.authService.login(dto);

      // ... (Logic cookie & redirect giữ nguyên)
      res.cookie('access_token', result.accessToken, {
        httpOnly: false,
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
      });

      const roleId = result.user.role_id;
      if (roleId === 1) return res.redirect('/admin/dashboard');
      else if (roleId === 3) return res.redirect('/recruiter/dashboard');
      else {
        return res.render('auth/login', {
          layout: false,
          error: 'Tài khoản Ứng viên vui lòng sử dụng Mobile App.',
        });
      }
    } catch (err: any) {
      // --- XỬ LÝ LỖI ---
      let errorMessage = 'Email hoặc mật khẩu không đúng.';

      // Nếu lỗi là Forbidden (403) -> Tức là bị Ban
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (err.status === 403) {
        errorMessage =
          'Tài khoản của bạn đã bị KHÓA. Vui lòng liên hệ quản trị viên.';
      }

      return res.render('auth/login', {
        layout: false,
        error: errorMessage, // Truyền lỗi xuống View
      });
    }
  }

  @Get('logout')
  logout(@Res() res: express.Response) {
    res.clearCookie('access_token');
    return res.redirect('/web/login');
  }
}
