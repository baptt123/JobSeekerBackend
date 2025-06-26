// auth.controller.ts
import { Controller, Post, UseGuards, Request, Res } from '@nestjs/common';
// @ts-ignore
import { LocalAuthGuard } from './local-auth.guard';
import { AuthService } from './auth.service';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Res({ passthrough: true }) res: Response) {
    const { access_token } = await this.authService.login(req.user);
    res.cookie('access_token', access_token, {
      httpOnly: true,
      sameSite: 'lax',
    });
    return { message: 'Login successful' };
  }
}
