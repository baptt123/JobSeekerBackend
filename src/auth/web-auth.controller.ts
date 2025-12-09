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

      // Lưu Token vào Cookie
      res.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: false, // Để true nếu chạy HTTPS
        maxAge: 24 * 60 * 60 * 1000, // 1 ngày
      });

      // Điều hướng dựa trên Role
      // 1: ADMIN, 2: CANDIDATE, 3: RECRUITER
      const roleId = result.user.role_id;

      if (roleId === 1) {
        return res.redirect('/admin/dashboard');
      } else if (roleId === 3) {
        return res.redirect('/recruiter/dashboard');
      } else {
        return res.render('auth/login', {
          layout: false,
          error: 'Tài khoản Ứng viên vui lòng sử dụng Mobile App.',
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      return res.render('auth/login', {
        layout: false,
        error: 'Email hoặc mật khẩu không đúng.',
      });
    }
  }

  @Get('logout')
  logout(@Res() res: express.Response) {
    res.clearCookie('access_token');
    return res.redirect('/web/login');
  }
}
