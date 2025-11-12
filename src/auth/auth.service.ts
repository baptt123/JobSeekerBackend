// src/auth/auth.service.ts
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterDto } from '../dto/register.dto';
import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserEntity } from '../entity/user.entity';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import * as argon2 from 'argon2';
import { AuthResponseDto } from '../dto/auth-response.dto';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
// [THÊM MỚI] Lấy kiểu dữ liệu từ Firebase Admin SDK
type FirebaseUserPayload = admin.auth.DecodedIdToken;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.usersService.userRepo.findOne({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        where: { user_id: payload.sub },
        relations: ['role'],
      });

      if (!user) {
        throw new UnauthorizedException('Người dùng không tồn tại');
      }

      const newPayload = {
        sub: user.user_id,
        email: user.email,
        role: user.role.role_name,
      };

      const newAccessToken = await this.jwtService.signAsync(newPayload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: process.env.JWT_ACCESS_EXPIRATION || '30m',
      });

      return { accessToken: newAccessToken };
    } catch (err) {
      console.error('Refresh ERROR:', err);
      throw new UnauthorizedException(
        'Refresh token hết hạn hoặc không hợp lệ',
      );
    }
  }

  async loginWithGoogle(
    firebaseUser: FirebaseUserPayload,
  ): Promise<AuthResponseDto> {
    if (!firebaseUser.email) {
      throw new UnauthorizedException('Token Firebase không có email');
    }

    try {
      // 1️⃣ Tìm user bằng email
      let user: UserEntity | null = await this.usersService.userRepo.findOne({
        where: { email: firebaseUser.email },
      });

      // 2️⃣ Nếu user đã tồn tại (bất kể là có pass hay không)
      if (user) {
        // 👇 LOGIC CŨ BỊ XÓA:
        // if (user.password_hash) { ... throw error ... }

        // 👇 LOGIC MỚI:
        // Cập nhật thông tin của họ từ Google (vì nó mới nhất)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        user.full_name = firebaseUser.name || user.full_name; // Ưu tiên tên Google
        if (firebaseUser.picture) {
          user.avatar_url = firebaseUser.picture;
        }
        // Bạn có thể thêm một trường để đánh dấu họ đã link Google
        // user.provider = 'google';

        await this.usersService.userRepo.save(user);
      } else {
        // 3️⃣ Nếu user chưa tồn tại → tạo mới
        user = new UserEntity();
        user.email = firebaseUser.email;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        user.full_name = firebaseUser.name || 'Người dùng Google';
        if (firebaseUser.picture != null) {
          user.avatar_url = firebaseUser.picture;
        }

        // 👇 Dùng Enum cho dễ đọc
        user.role_id = 2; // Giả sử 2 là RECRUITER

        await this.usersService.userRepo.save(user);
      }

      // 4️⃣ Trả về JWT hệ thống (cho cả 2 trường hợp)
      return this._generateSystemJwt(user);
    } catch (err) {
      // Khối catch này đã tốt, giữ nguyên
      if (err instanceof UnauthorizedException) throw err;
      console.error('Lỗi nghiêm trọng khi đăng nhập Google:', err);
      throw new InternalServerErrorException(
        'Lỗi máy chủ khi xác thực: ' + (err as Error).message,
      );
    }
  }

  /**
   * [THÊM MỚI]
   * Tạo JWT của hệ thống từ thông tin UserEntity
   */
  // 👇 3. SỬA LẠI HOÀN TOÀN HÀM NÀY
  private async _generateSystemJwt(user: UserEntity): Promise<AuthResponseDto> {
    const payload = {
      sub: user.user_id,
      email: user.email,
      role: user.role_id,
    };

    // Tạo cả 2 token
    const [accessToken, refreshToken] = await Promise.all([
      // Access Token (thời gian ngắn, ví dụ 15 phút)
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION'), // '15m'
      }),
      // Refresh Token (thời gian dài, ví dụ 7 ngày)
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'), // Nên là secret khác
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION'), // '7d'
      }),
    ]);

    // Tạo object user payload KHỚP với Flutter
    // Flutter chỉ cần: { user: { id: ... } }
    // Chúng ta trả về thêm để sau này Flutter dễ dùng
    const userPayload = {
      id: user.user_id, // 👈 Ánh xạ user_id -> id
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      role_id: user.role_id,
    };

    // Trả về DTO hoàn chỉnh
    return {
      accessToken: accessToken,
      refreshToken: refreshToken, // 👈 Trả về refreshToken
      user: userPayload, // 👈 Trả về user object đã map
    };
  }
}
