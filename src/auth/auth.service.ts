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

  async register(dto: RegisterDto): Promise<UserEntity> {
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

  // Trong auth.service.ts -> login()
  async login(dto: LoginDto) {
    try {
      const user = await this.usersService.userRepo.findOne({
        where: { email: dto.email },
        relations: ['role'],
        // 👇 Cần thêm dòng này để lấy password_hash ra so sánh
        select: [
          'user_id',
          'email',
          'password_hash',
          'full_name',
          'avatar_url',
          'role_id',
          'role',
        ],
      });

      // Hoặc cách viết ngắn gọn hơn nếu không liệt kê hết fields:
      /*
            const user = await this.usersService.userRepo.createQueryBuilder('user')
              .addSelect('user.password_hash')
              .leftJoinAndSelect('user.role', 'role')
              .where('user.email = :email', { email: dto.email })
              .getOne();
            */

      if (!user)
        throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

      // Logic google login (nếu user chỉ có email google mà không có pass hash)
      if (!user.password_hash)
        throw new UnauthorizedException(
          'Tài khoản này đăng nhập bằng Google/Facebook',
        );

      const match = await argon2.verify(user.password_hash, dto.password);
      if (!match)
        throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

      return this._generateSystemJwt(user);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException('Lỗi hệ thống khi đăng nhập');
    }
  }

  // 2. REFRESH TOKEN (Stateless)
  async refreshToken(dto: RefreshTokenDto) {
    try {
      // Verify Refresh Token
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Kiểm tra user còn tồn tại trong DB không
      const user = await this.usersService.userRepo.findOne({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        where: { user_id: payload.sub },
        relations: ['role'],
      });

      if (!user)
        throw new UnauthorizedException('Người dùng không còn tồn tại');

      // ✅ QUAN TRỌNG: Trả về cấu trúc giống hệt Login (gồm cả User info + Tokens mới)
      // Để Client dùng chung hàm parse JSON
      return this._generateSystemJwt(user);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      throw new UnauthorizedException(
        'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại',
      );
    }
  }

  // ... (Giữ nguyên logic Google Login) ...

  // Helper: Tạo Token và Format Response chuẩn
  private async _generateSystemJwt(user: UserEntity): Promise<AuthResponseDto> {
    const payload = {
      sub: user.user_id,
      email: user.email,
      role: user.role_id,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        // 🔥 SỬA: Đổi JWT_ACCESS_TOKEN_SECRET -> JWT_ACCESS_SECRET
        secret:
          this.configService.get<string>('JWT_ACCESS_SECRET') ||
          'access-secret',
        expiresIn:
          this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          'refresh-secret',
        expiresIn:
          this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d',
      }),
    ]);

    // Format dữ liệu trả về client
    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: {
        id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        role_id: user.role_id,
      },
    };
  }

  async loginWithGoogle(
    firebaseUser: FirebaseUserPayload,
    deviceToken?: string, // [THÊM MỚI] Nhận thêm tham số
  ): Promise<AuthResponseDto> {
    if (!firebaseUser.email) {
      throw new UnauthorizedException('Token Firebase không có email');
    }

    try {
      let user: UserEntity | null = await this.usersService.userRepo.findOne({
        where: { email: firebaseUser.email },
      });

      if (user) {
        // Cập nhật thông tin
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        user.full_name = firebaseUser.name || user.full_name;
        if (firebaseUser.picture) {
          user.avatar_url = firebaseUser.picture;
        }
        // [THÊM MỚI] Cập nhật Device Token nếu có
        if (deviceToken) {
          user.fcm_token = deviceToken;
        }
        await this.usersService.userRepo.save(user);
      } else {
        // Tạo mới
        user = new UserEntity();
        user.email = firebaseUser.email;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        user.full_name = firebaseUser.name || 'Người dùng Google';
        if (firebaseUser.picture != null) {
          user.avatar_url = firebaseUser.picture;
        }
        user.role_id = 2; // Default role
        // [THÊM MỚI] Lưu Device Token
        if (deviceToken) {
          user.fcm_token = deviceToken;
        }
        await this.usersService.userRepo.save(user);
      }

      return this._generateSystemJwt(user);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      console.error('Lỗi login google:', err);
      throw new InternalServerErrorException(
        'Lỗi máy chủ: ' + (err as Error).message,
      );
    }
  }
}
