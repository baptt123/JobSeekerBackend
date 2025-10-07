// src/auth/auth.service.ts
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterDto } from '../dto/register.dto';
import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { UserEntity } from '../entity/user.entity';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import * as argon2 from 'argon2';
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

  // async login(dto: LoginDto) {
  //   const user = await this.usersService.userRepo.findOne({
  //     where: { email: dto.email },
  //     relations: ['role'], // 👈 thêm dòng này
  //   });
  //   if (!user) throw new UnauthorizedException('Không tìm thấy người dùng');
  //
  //   const match = await bcrypt.compare(dto.password, user.password_hash);
  //   console.log(match);
  //   if (!match) throw new UnauthorizedException('Mật khẩu không đúng');
  //
  //   const payload = {
  //     sub: user.user_id,
  //     email: user.email,
  //     role: user.role.role_name,
  //   };
  //
  //   const accessToken = await this.jwtService.signAsync(payload, {
  //     secret: process.env.JWT_ACCESS_SECRET,
  //     expiresIn: process.env.JWT_ACCESS_EXPIRATION,
  //   });
  //
  //   const refreshToken = await this.jwtService.signAsync(payload, {
  //     secret: process.env.JWT_REFRESH_SECRET,
  //     expiresIn: process.env.JWT_REFRESH_EXPIRATION,
  //   });
  //
  //   return {
  //     message: 'Đăng nhập thành công',
  //     accessToken,
  //     refreshToken,
  //     user: {
  //       id: user.user_id,
  //       email: user.email,
  //       fullName: user.full_name,
  //       role: user.role_id,
  //     },
  //   };
  // }
  async login(dto: LoginDto) {
    try {
      // Lấy user từ DB, kèm role
      const user = await this.usersService.userRepo.findOne({
        where: { email: dto.email },
        relations: ['role'],
      });

      if (!user) throw new UnauthorizedException('Không tìm thấy người dùng');

      // Kiểm tra hash có tồn tại
      if (!user.password_hash) {
        console.error('Hash mật khẩu từ DB bị trống');
        throw new UnauthorizedException('User chưa đặt mật khẩu');
      }

      console.log('Hash từ DB:', user.password_hash);
      console.log('Password nhập:', dto.password);

      // So sánh mật khẩu
      const match = await argon2.verify(user.password_hash, dto.password);
      console.log('Kết quả verify:', match);

      if (!match) throw new UnauthorizedException('Mật khẩu không đúng');

      // Tạo payload JWT
      const payload = {
        sub: user.user_id,
        email: user.email,
        role: user.role.role_name,
      };

      const accessToken = await this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: process.env.JWT_ACCESS_EXPIRATION,
      });

      const refreshToken = await this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRATION,
      });

      return {
        message: 'Đăng nhập thành công',
        accessToken,
        refreshToken,
        user: {
          id: user.user_id,
          email: user.email,
          fullName: user.full_name,
          role: user.role_id,
        },
      };
    } catch (error) {
      console.error('Login ERROR:', error);
      throw new InternalServerErrorException('Server bị lỗi');
    }
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
