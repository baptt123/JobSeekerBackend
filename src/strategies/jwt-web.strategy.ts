import { Injectable, UnauthorizedException } from '@nestjs/common'; // <--- Thêm UnauthorizedException
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from '../entity/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class JwtWebStrategy extends PassportStrategy(Strategy, 'jwt-web') {
  constructor(
    configService: ConfigService,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      // Tự động lấy token từ cookie 'access_token'
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          let data = null;
          if (request && request.cookies) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            data = request.cookies['access_token'];
          }
          return data;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_ACCESS_SECRET') || 'access-secret',
    });
  }

  async validate(payload: any) {
    // 1. Tìm user
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
    const user = await this.userRepo.findOneBy({ user_id: payload.userId });

    // 2. [QUAN TRỌNG] Kiểm tra null để TypeScript không báo lỗi
    if (!user) {
      throw new UnauthorizedException('User not found or deactivated');
    }

    // 3. Trả về thông tin (đã chắc chắn user tồn tại)
    return {
      userId: user.user_id,
      email: user.email,
      roleId: user.role_id,
      full_name: user.full_name,
      avatar_url:
        user.avatar_url || 'https://ui-avatars.com/api/?name=' + user.full_name,
    };
  }
}
