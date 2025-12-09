import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtWebStrategy extends PassportStrategy(Strategy, 'jwt-web') {
  constructor(configService: ConfigService) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      // Tự động lấy token từ cookie có tên 'access_token'
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

  validate(payload: any) {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      userId: Number(payload.sub),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      email: payload.email,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      role: payload.role,
    };
  }
}
