// src/auth/auth.service.ts
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { MailerService } from '@nestjs-modules/mailer';
import { RegisterDto } from '../dto/register.dto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserEntity } from '../entity/user.entity';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginDto } from '../dto/login.dto';
import * as bcrypt from 'bcrypt';
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) {}

  async createUser(dto: RegisterDto): Promise<UserEntity> {
    return this.usersService.create(dto);
  }
  async updatePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.usersService.updatePassword(userId, dto);
  }
  async forgotPassword(email: ForgotPasswordDto): Promise<{ message: string }> {
    return this.usersService.forgotPassword(email);
  }
  async login(dto: LoginDto) {
    const user = await this.usersService.userRepo.findOne({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const match = await bcrypt.compare(dto.password, user.password_hash);
    if (!match) throw new UnauthorizedException('Invalid email or password');

    const payload = {
      sub: user.user_id,
      email: user.email,
      role: user.role_id,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    return {
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user.user_id,
        email: user.email,
        fullName: user.full_name,
      },
    };
  }

  async validateUser(userId: number) {
    return await this.usersService.userRepo.findOne({
      where: { user_id: userId },
    });
  }
}
