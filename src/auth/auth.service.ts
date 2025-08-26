// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password_hash))) {
      return user;
    }
    return null;
  }

  async login(user: any) {
    const payload = {
      userId: user.user_id,
      email: user.email,
      role: user.role_name,
    };
    return {
      access_token: this.jwtService.sign(payload, {
        secret: process.env.JWT_ACCESS_TOKEN_SECRET || 'access-secret',
        expiresIn: '15m',
      }),
      refresh_token: this.jwtService.sign(payload, {
        secret: process.env.JWT_REFRESH_TOKEN_SECRET || 'refresh-secret',
        expiresIn: '7d',
      }),
      user: {
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role_name,
      },
    };
  }

  async register(userDto: any) {
    const existingUser = await this.usersService.findByEmail(userDto.email);
    if (existingUser) {
      throw new UnauthorizedException('Email already registered');
    }
    const hashedPassword = await bcrypt.hash(userDto.password, 10);
    return this.usersService.create({
      ...userDto,
      password_hash: hashedPassword,
    });
  }

  async refreshTokens(userId: number, refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_TOKEN_SECRET || 'refresh-secret',
      });
      if (payload.userId !== userId) {
        throw new UnauthorizedException();
      }
      const user = await this.usersService.findById(userId);
      if (!user) throw new UnauthorizedException();
      return this.login(user);
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
