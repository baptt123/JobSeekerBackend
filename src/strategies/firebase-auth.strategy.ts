import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import * as admin from 'firebase-admin';
import { Request } from 'express';

@Injectable()
export class FirebaseAuthStrategy extends PassportStrategy(
  Strategy,
  'firebase-auth', // 👈 Tên của strategy
) {
  constructor() {
    super();
    // Đảm bảo bạn đã khởi tạo Firebase Admin ở main.ts
    // Ví dụ:
    // if (!admin.apps.length) {
    //   admin.initializeApp({
    //     credential: admin.credential.cert(serviceAccount),
    //   });
    // }
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  async validate(req: Request): Promise<admin.auth.DecodedIdToken> {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Thiếu Authorization header');
    }

    const token = authHeader.split(' ')[1]; // "Bearer <token>"
    if (!token) {
      throw new UnauthorizedException('Token không đúng định dạng');
    }

    try {
      // Xác thực token và trả về payload
      return await admin.auth().verifyIdToken(token);
    } catch (err) {
      this.handleError(err);
    }
  }

  private handleError(err: any) {
    console.error('Firebase Auth Error:', err);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (err.code === 'auth/id-token-expired') {
      throw new UnauthorizedException('Token Firebase đã hết hạn');
    }
    throw new UnauthorizedException('Token Firebase không hợp lệ');
  }
}
