// src/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { MailerService } from '@nestjs-modules/mailer';
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);

    if (user && (await bcrypt.compare(pass, user.password_hash))) {
      return user;
    }
    return null;
  }

  async login(
    user: any,
  ): Promise<{ access_token: string; refresh_token: string; user: any }> {
    const payload = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      userId: user.user_id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      email: user.email,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      role: user.role_name,
    };
    const access_token = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_TOKEN_SECRET || 'access-secret',
      expiresIn: '15m',
    });
    const refresh_token = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_TOKEN_SECRET || 'refresh-secret',
      expiresIn: '7d',
    });
    return {
      access_token,
      refresh_token,
      user: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        userId: user.user_id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        email: user.email,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        fullName: user.full_name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        role: user.role_name,
      },
    };
  }

  async register(userDto: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
    const existingUser = await this.usersService.findByEmail(userDto.email);
    if (existingUser) {
      throw new UnauthorizedException('Email already registered');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
    const hashedPassword = await bcrypt.hash(userDto.password, 10);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.usersService.create({
      ...userDto,
      password_hash: hashedPassword,
    });
  }

  async refreshTokens(userId: number, refreshToken: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_TOKEN_SECRET || 'refresh-secret',
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (payload.userId !== userId) {
        throw new UnauthorizedException();
      }
      const user = await this.usersService.findById(userId);
      if (!user) throw new UnauthorizedException();
      return this.login(user);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findOne(email);
    if (!user) throw new NotFoundException('Email not found');

    const token = this.jwtService.sign(
      { email, type: 'RESET_PASSWORD' },
      { expiresIn: '30m' },
    );

    const resetLink = `your-app://reset-password?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Reset your password',
      template: 'reset-password', // Tên file template trong folder templates
      context: {
        // Dữ liệu truyền vào template
        token,
        resetLink,
      },
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    let payload: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      payload = this.jwtService.verify(token);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (payload.type !== 'RESET_PASSWORD') throw new Error();
    } catch {
      throw new BadRequestException('Token invalid or expired');
    }
    const user = await this.usersService.findOne(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
      payload.email,
    );
    if (!user) throw new NotFoundException('User not found');

    user.password_hash = await bcrypt.hash(newPassword, 10);
    await this.usersService.save(user);
  }
}
