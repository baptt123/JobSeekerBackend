import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAuthStrategy extends PassportStrategy(
  Strategy,
  'firebase-auth',
) {
  constructor() {
    super();
  }

  async validate(req: Request): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Thiếu Authorization header');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    const token = authHeader.split(' ')[1]; // "Bearer <token>"
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return await admin.auth().verifyIdToken(token); // Trả về thông tin user
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      throw new UnauthorizedException('Token Firebase không hợp lệ');
    }
  }
}
