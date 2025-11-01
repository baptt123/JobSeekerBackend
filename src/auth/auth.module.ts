// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { UserModule } from '../user/user.module';
import { AuthService } from './auth.service';
import { JwtRefreshTokenStrategy } from '../strategies/jwt-refresh-token-strategy';
import { AuthController } from './auth.controller';
import { FirebaseModuleModule } from '../firebase-module/firebase-module.module';
import { FirebaseAuthStrategy } from '../strategies/firebase-auth.strategy';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_TOKEN_SECRET || 'access-secret',
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m' },
    }),
    FirebaseModuleModule,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshTokenStrategy,
    FirebaseAuthStrategy,
  ],
  controllers: [AuthController],
  exports: [AuthService, PassportModule, JwtModule],
})
export class AuthModule {}
