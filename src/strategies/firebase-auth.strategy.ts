import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import * as admin from 'firebase-admin';
import { Request } from 'express';

@Injectable()
export class FirebaseAuthStrategy extends PassportStrategy(
  Strategy,
  'firebase-auth',
) {
  private readonly logger = new Logger(FirebaseAuthStrategy.name);

  constructor() {
    super();
  }

  async validate(req: Request): Promise<admin.auth.DecodedIdToken> {
    const authHeader = req.headers['authorization'];
    if (!authHeader)
      throw new UnauthorizedException('Thiếu Authorization header');

    const token = authHeader.split(' ')[1];
    if (!token) throw new UnauthorizedException('Token không đúng định dạng');

    try {
      return await admin.auth().verifyIdToken(token);
    } catch (err: any) {
      // ✅ Nếu là lỗi format token (do client gửi JWT thường), bỏ qua im lặng
      if (err.code === 'auth/argument-error') {
        throw new UnauthorizedException('Not a Firebase token');
      }

      // Chỉ log lỗi lạ
      this.logger.warn(`Firebase Auth Failed: ${err.message}`);
      throw new UnauthorizedException('Xác thực Firebase thất bại');
    }
  }
}
