// src/auth/auth.service.ts
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterDto } from '../dto/register.dto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserEntity } from '../entity/user.entity';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import * as bcrypt from 'bcrypt';
import { RefreshTokenDto } from '../../extra_code/refresh-token';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UserService,
    private readonly jwtService: JwtService,
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

  async forgotPassword(email: string): Promise<{ message: string }> {
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

  async refreshToken(refreshTokenDTO: RefreshTokenDto) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payload = this.jwtService.verify(refreshTokenDTO.refreshToken, {
        ignoreExpiration: false,
      });
      const user = await this.usersService.userRepo.findOne({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        where: { user_id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException();
      }
      const newPayload = { sub: user.user_id, email: user.email };
      return {
        accessToken: this.jwtService.sign(newPayload, { expiresIn: '15m' }),
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      throw new UnauthorizedException(
        'Refresh token hết hạn hoặc không hợp lệ',
      );
    }
  }
}
