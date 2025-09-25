// src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Post, Put,
  Req, UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from '../dto/register.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { RolesGuard } from '../guard/role-auth.guard';
import { LoginDto } from '../dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async signup(@Body() dto: RegisterDto) {
    return await this.authService.createUser(dto);
  }
  @Put('update-password')
  @UseGuards(RolesGuard)
  async updatePassword(
    @Req() req: any,
    @Body(new ValidationPipe()) dto: ChangePasswordDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
    return this.authService.updatePassword(req.user.user_id, dto);
  }
  @Put('forgot-password')
  @UseGuards(RolesGuard)
  async forgotPassword(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
    return this.authService.forgotPassword(req.user.email);
  }
  @Post('login')
  async login(@Body(new ValidationPipe()) dto: LoginDto) {
    return this.authService.login(dto);
  }
}
